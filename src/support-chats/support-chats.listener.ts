import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WhatsappWebhookPayload } from '@types';
import { WhatsappGateway } from 'whatsapp/whatsapp.gateway';

@Injectable()
export class SupportChatsListener {
  private readonly logger = new Logger(SupportChatsListener.name);

  constructor(
    private readonly whatsappGateway: WhatsappGateway,
  ) {}

  @OnEvent('whatsapp.message_create', { async: true })
  async onMessageCreate(payload: WhatsappWebhookPayload) {
    try {
      this.whatsappGateway.emitEvent('whatsapp:messages', payload);
    } catch (error) {
      this.logger.error('Erro ao processar mensagens do WhatsApp:', error);
      throw error;
    }
  }
}
