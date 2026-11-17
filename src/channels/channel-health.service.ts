import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { ChannelsRepository } from './channels.repository';
import { ChannelsService } from './channels.service';

/** Falhas seguidas antes de dar o canal como desconectado. */
export const FALHAS_PARA_DESCONECTAR = 2;

/**
 * Confere de minuto em minuto, no provider, cada canal que o portal mostra
 * como conectado.
 *
 * O status do canal vem dos webhooks de conexão. Se o gateway cai de forma
 * abrupta, nenhum webhook chega e o canal seguia "Conectado" até alguém
 * tentar enviar. Sessão caída com o gateway no ar é corrigida na hora pelo
 * `sincronizarStatus`; gateway sem resposta só derruba o status na segunda
 * falha seguida, para um restart rápido ou um soluço de rede não piscar o
 * status no portal.
 */
@Injectable()
export class ChannelHealthService {
  private readonly logger = new Logger(ChannelHealthService.name);

  /** Falhas seguidas por canal; zera quando o provider responde. */
  private readonly falhas = new Map<number, number>();

  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly channelsService: ChannelsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async verificarConectados(): Promise<void> {
    const canais = await this.channelsRepository.findConectadosComSessao();
    const ids = new Set(canais.map((canal) => canal.id));

    // Canal que saiu de "Conectado" por outro caminho começa do zero se voltar.
    for (const id of this.falhas.keys()) {
      if (!ids.has(id)) this.falhas.delete(id);
    }

    await Promise.all(canais.map((canal) => this.verificarCanal(canal.id)));
  }

  private async verificarCanal(channelId: number): Promise<void> {
    try {
      await this.channelsService.sincronizarStatus(channelId);
      this.falhas.delete(channelId);
      return;
    } catch (erro) {
      const total = (this.falhas.get(channelId) ?? 0) + 1;

      if (total < FALHAS_PARA_DESCONECTAR) {
        this.falhas.set(channelId, total);
        this.logger.warn(
          `Canal ${channelId}: provider não respondeu (${total}/${FALHAS_PARA_DESCONECTAR}): ${erro?.message ?? erro}`,
        );
        return;
      }

      this.falhas.delete(channelId);
    }

    try {
      await this.channelsService.marcarSemResposta(channelId);
    } catch (erro) {
      this.logger.error(
        `Canal ${channelId}: falha ao marcar como desconectado: ${erro?.message ?? erro}`,
      );
    }
  }
}
