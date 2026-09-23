import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, IsNull, LessThan, Not } from 'typeorm';

import { StorageService } from '@/storage/storage.service';
import { SystemSettingsService } from '@/system-settings/system-settings.service';
import { InternalChatMessages } from './entities/internal-chat-messages.entity';

/** Mensagens processadas por rodada, para não segurar transação longa demais. */
const TAMANHO_LOTE = 200;

/**
 * Remove do storage as mídias antigas do chat interno.
 *
 * Mesmo desenho de `MediaRetentionService`, que faz isso para o atendimento:
 * o arquivo some, a mensagem fica, e `media_expired` diz ao front que ali havia
 * algo - "mídia expirada" é diferente de mensagem apagada.
 *
 * ⚠️ **São dois serviços, de propósito.** O do atendimento varre
 * `support_chat_messages` e este varre `internal_chat_messages`; cada um lê seu
 * próprio prazo. Unificá-los obrigaria o módulo do chat interno a depender do
 * de atendimento, e imporia um prazo único a dois tipos de conversa com valor
 * bem diferente: a do cliente é registro do que foi combinado, a da equipe é
 * operacional.
 */
@Injectable()
export class InternalChatRetentionService {
  private readonly logger = new Logger(InternalChatRetentionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly settings: SystemSettingsService,
  ) {}

  /**
   * Roda de madrugada, meia hora depois da retenção do atendimento.
   *
   * Escalonado para os dois não disputarem storage e banco no mesmo minuto -
   * cada um varre sua tabela, mas ambos apagam objetos no mesmo bucket.
   */
  // Não há constante para 3h30 em `CronExpression` - a expressão é direta.
  @Cron('30 3 * * *')
  async expirarMidiasAntigas(): Promise<{ expiradas: number; falhas: number }> {
    const meses = await this.settings.getInteiro('chat_interno_retencao_meses');
    const limite = new Date();
    limite.setMonth(limite.getMonth() - meses);

    this.logger.log(
      `Expirando mídias do chat interno anteriores a ${limite.toISOString().slice(0, 10)}...`,
    );

    let expiradas = 0;
    let falhas = 0;

    // Em lotes: a varredura pode alcançar muitas mensagens, e não convém manter
    // uma transação aberta durante todas as chamadas ao storage.
    for (;;) {
      const lote = await this.dataSource.getRepository(InternalChatMessages).find({
        select: ['id', 'media_url'],
        where: {
          has_media: true,
          media_expired: false,
          media_url: Not(IsNull()),
          created_at: LessThan(limite),
        },
        take: TAMANHO_LOTE,
        order: { created_at: 'ASC' },
      });

      if (!lote.length) break;

      for (const mensagem of lote) {
        try {
          await this.storageService.deleteObject(mensagem.media_url);
        } catch (err) {
          // Objeto já ausente não impede a marcação; outros erros são
          // registrados e a mensagem fica para a próxima rodada.
          const ausente = err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;

          if (!ausente) {
            this.logger.error(
              `Falha ao remover a mídia ${mensagem.media_url}: ${err.message ?? err}`,
            );
            falhas++;
            continue;
          }
        }

        await this.dataSource.getRepository(InternalChatMessages).update(mensagem.id, {
          // A key some junto: sem o objeto no storage, mantê-la só produziria
          // URL apontando para o vazio.
          media_url: null,
          media_expired: true,
          media_expired_at: new Date(),
        });
        expiradas++;
      }

      // Lote incompleto significa que a varredura chegou ao fim.
      if (lote.length < TAMANHO_LOTE) break;
    }

    if (expiradas || falhas) {
      this.logger.log(
        `Retenção do chat interno concluída: ${expiradas} mídia(s) expirada(s), ${falhas} falha(s).`,
      );
    } else {
      this.logger.log('Retenção do chat interno concluída: nenhuma mídia a expirar.');
    }

    return { expiradas, falhas };
  }
}
