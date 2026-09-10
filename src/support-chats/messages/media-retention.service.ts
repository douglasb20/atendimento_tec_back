import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, IsNull, LessThan, Not } from 'typeorm';

import { StorageService } from '@/storage/storage.service';
import { SupportChatMessages } from './entities/support-chat-messages.entity';

/** Meses de retenção da mídia. Configurável por ambiente. */
const MESES_RETENCAO_PADRAO = 3;

/** Mensagens processadas por rodada, para não segurar transação longa demais. */
const TAMANHO_LOTE = 200;

/**
 * Remove do storage as mídias mais antigas que o período de retenção.
 *
 * A mensagem é preservada: apenas o arquivo é apagado e o registro passa a ser
 * marcado com `media_expired`. Isso mantém o histórico legível (legenda, autor,
 * data) e permite ao front distinguir mídia expirada de mensagem apagada pelo
 * contato (`is_deleted`).
 */
@Injectable()
export class MediaRetentionService {
  private readonly logger = new Logger(MediaRetentionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
  ) {}

  /** Roda de madrugada, quando o uso do sistema é menor. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expirarMidiasAntigas(): Promise<{ expiradas: number; falhas: number }> {
    const meses = Number(process.env.MEDIA_RETENTION_MONTHS) || MESES_RETENCAO_PADRAO;
    const limite = new Date();
    limite.setMonth(limite.getMonth() - meses);

    this.logger.log(`Expirando mídias anteriores a ${limite.toISOString().slice(0, 10)}...`);

    let expiradas = 0;
    let falhas = 0;

    // Processa em lotes: a varredura pode alcançar muitas mensagens e não
    // convém manter uma transação aberta durante todas as chamadas ao storage.
    for (;;) {
      const lote = await this.dataSource.getRepository(SupportChatMessages).find({
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
          // Objeto já ausente não impede a marcação; outros erros são registrados
          // e a mensagem fica para a próxima rodada.
          const ausente = err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
          if (!ausente) {
            this.logger.error(
              `Falha ao remover a mídia ${mensagem.media_url}: ${err.message ?? err}`,
            );
            falhas++;
            continue;
          }
        }

        await this.dataSource.getRepository(SupportChatMessages).update(mensagem.id, {
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
      this.logger.log(`Retenção concluída: ${expiradas} mídia(s) expirada(s), ${falhas} falha(s).`);
    } else {
      this.logger.log('Retenção concluída: nenhuma mídia a expirar.');
    }

    return { expiradas, falhas };
  }
}
