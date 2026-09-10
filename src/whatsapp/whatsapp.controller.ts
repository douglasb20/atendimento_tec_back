import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

import { IntegrationsService } from 'integrations/integrations.service';
import { EvolutionWebhookDto } from './dto/evolution-webhook.dto';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  /**
   * Recebe os eventos do provider.
   *
   * Semântica dos códigos de resposta importa aqui: a Evolution repete a
   * entrega até 10 vezes com backoff, mas não repete respostas 400, 401, 403,
   * 404 e 422. Por isso payload inválido ou canal desconhecido respondem 4xx
   * (não há o que reprocessar), enquanto falhas nossas sobem como 5xx para que
   * o evento seja reentregue.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: EvolutionWebhookDto,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ) {
    const channel = await this.whatsappService.findChannelBySession(payload.instance);

    if (!channel) {
      // 400: não existe canal para esta instância, reentregar não resolveria.
      this.logger.warn(`Webhook recebido para instância desconhecida: ${payload.instance}`);
      throw new BadRequestException('Instância não vinculada a nenhum canal');
    }

    await this.assertAuthorized(channel.integration_id, webhookSecret);

    // Falhas aqui sobem como 5xx de propósito: são transitórias e vale reentregar.
    await this.whatsappService.processWebhook({
      event: payload.event,
      instance: payload.instance,
      data: payload.data,
      sender: payload.sender,
      date_time: payload.date_time,
      isLatest: payload.isLatest,
      progress: payload.progress,
    });

    return { status: 'received' };
  }

  /**
   * Valida o segredo configurado na integração. Usamos um header próprio porque
   * o campo `apikey` do corpo da Evolution vem nulo por padrão.
   */
  private async assertAuthorized(
    integrationId: number | null,
    receivedSecret?: string,
  ): Promise<void> {
    const expectedSecret = integrationId
      ? await this.integrationsService.getWebhookSecret(integrationId)
      : null;

    // Integração sem segredo definido (ex.: canal legado) não bloqueia o fluxo.
    if (!expectedSecret) return;

    if (!receivedSecret || !this.secretsMatch(receivedSecret, expectedSecret)) {
      this.logger.warn('Webhook rejeitado: segredo inválido.');
      throw new ForbiddenException('Segredo de webhook inválido');
    }
  }

  /** Comparação em tempo constante, para não expor o segredo por timing. */
  private secretsMatch(received: string, expected: string): boolean {
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
