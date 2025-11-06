import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { MessagePayload, WhatsappWebhookPayload } from '@types';
import { SupportChatsService } from './support-chats.service';

@Injectable()
export class SupportChatsListener {
  private readonly logger = new Logger(SupportChatsListener.name);

  constructor(private readonly supportChatsService: SupportChatsService) {}

  @OnEvent('whatsapp.message_create', { async: true })
  async onMessageCreate(payload: WhatsappWebhookPayload<MessagePayload>) {
    try {
      await this.supportChatsService.onMessageCreate(payload);
    } catch (error) {
      this.logger.error('Erro ao processar mensagens do WhatsApp:', error);
      throw error;
    }
  }
}
