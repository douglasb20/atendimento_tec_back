import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ChannelsRepository } from '@/channels/channels.repository';
import { SupportChatsRepository } from './support-chats.repository';
import { SupportChatsService } from './support-chats.service';

/**
 * Encerra sozinha uma conversa parada há tempo demais, com aviso prévio ao
 * cliente - configurável por canal (`channels.inatividade_*`).
 *
 * Primeiro job a varrer atendimentos em andamento; mesmo padrão de
 * `MediaRetentionService` (`support-chats/messages/media-retention.service.ts`),
 * mas de minuto em minuto - a inatividade se mede em minutos, não em dias.
 */
@Injectable()
export class InactivityResolutionService {
  private readonly logger = new Logger(InactivityResolutionService.name);

  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly supportChatsRepository: SupportChatsRepository,
    private readonly supportChatsService: SupportChatsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async resolverInativos(): Promise<void> {
    const canais = await this.channelsRepository.findComInatividadeAtiva();
    if (!canais.length) return;

    for (const canal of canais) {
      // Canal com o switch ligado mas sem os dois tempos configurados ainda
      // (tela salva incompleta, ou registro antigo) - nada a fazer.
      if (!canal.inatividade_resolver_em_minutos || !canal.inatividade_avisar_em_minutos) {
        continue;
      }

      try {
        await this.resolverInativosDoCanal(canal);
      } catch (err) {
        this.logger.error(
          `Falha ao resolver inatividade do canal ${canal.id}: ${err.message ?? err}`,
        );
      }
    }
  }

  private async resolverInativosDoCanal(canal: {
    id: number;
    inatividade_resolver_em_minutos: number;
    inatividade_avisar_em_minutos: number;
    inatividade_mensagem_aviso: string | null;
  }): Promise<void> {
    const conversas = await this.supportChatsRepository.buscarInativosPorCanal(canal.id);

    // Minuto a partir do qual o aviso deve sair - antes de
    // `inatividade_resolver_em_minutos`, na quantidade configurada.
    const minutoDoAviso = canal.inatividade_resolver_em_minutos - canal.inatividade_avisar_em_minutos;

    for (const conversa of conversas) {
      // Sem nenhuma mensagem manual ainda depois de aceito: não é inativa -
      // os dois campos de minutos vêm `null` juntos nesse caso (mesmo `WHERE`
      // na subquery), então checar um cobre o outro.
      if (conversa.minutos_desde_ultima_mensagem == null) continue;

      // Avisar e finalizar usam o tempo desde a ÚLTIMA MENSAGEM MANUAL, sem o
      // piso do aviso: `minutos_inativa` (com `GREATEST` sobre
      // `inatividade_avisada_em`) serve só para decidir se pode reenviar o
      // aviso, mais abaixo - usá-lo aqui também fazia o prazo de "resolver em
      // X min" reiniciar a contar a partir do aviso, e uma conversa demorava
      // até o dobro do configurado para fechar sempre que um aviso saía no
      // meio do caminho (achado em produção).
      if (conversa.minutos_desde_ultima_mensagem >= canal.inatividade_resolver_em_minutos) {
        // `findParaEstado` recarrega com as relações que
        // `finalizarPorInatividade`/`enviaMensagemAutomatica` precisam
        // (contact, channel) - a linha crua da varredura não basta.
        const supportChat = await this.supportChatsRepository.findParaEstado(conversa.id);
        if (!supportChat) continue;

        await this.supportChatsService.finalizarPorInatividade(supportChat);
        continue;
      }

      if (conversa.minutos_desde_ultima_mensagem >= minutoDoAviso) {
        // Já avisado nesta janela - não repete a cada tick do cron.
        if (conversa.inatividade_avisada_em) continue;

        const supportChat = await this.supportChatsRepository.findParaEstado(conversa.id);
        if (!supportChat) continue;

        await this.supportChatsService.enviarAvisoInatividade(
          supportChat,
          canal.inatividade_mensagem_aviso,
        );
        continue;
      }

      // Abaixo do minuto do aviso: só reseta se há mesmo uma mensagem NOVA,
      // posterior ao aviso - comparar com `minutos_inativa` (que já usa o
      // aviso como piso) reabria o mesmo loop, porque o tempo decorrido
      // desde o aviso sempre cruza essa marca pouco depois de avisar, sem
      // nenhuma mensagem nova ter chegado de verdade.
      const respondidaDepoisDoAviso =
        conversa.inatividade_avisada_em &&
        conversa.ultima_mensagem_em &&
        new Date(conversa.ultima_mensagem_em) > new Date(conversa.inatividade_avisada_em);

      if (respondidaDepoisDoAviso) {
        await this.supportChatsRepository.limpaAvisoInatividade(conversa.id);
      }
    }
  }
}
