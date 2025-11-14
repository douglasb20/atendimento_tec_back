import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import {
  ChatPayload,
  MessageEditPayload,
  MessagePayload,
  ReactionPayload,
  WhatsappWebhookPayload,
} from '@types';
import { SupportChatsService } from './support-chats.service';

@Injectable()
export class SupportChatsListener {
  private readonly logger = new Logger(SupportChatsListener.name);

  constructor(private readonly supportChatsService: SupportChatsService) {}

  @OnEvent('whatsapp.message_create')
  async onMessageCreate(payload: WhatsappWebhookPayload<MessagePayload>) {
    try {
      await this.supportChatsService.onMessageCreate(payload);
    } catch (error) {
      this.logger.error('Erro ao processar mensagens create do WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('whatsapp.unread_count')
  async onMessagesUnreadCount(payload: WhatsappWebhookPayload<ChatPayload>) {
    try {
      await this.supportChatsService.onMessagesUnreadCount(payload);
    } catch (error) {
      this.logger.error('Erro ao processar unread_count do WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('whatsapp.message_ack')
  async onMessageAck(payload: WhatsappWebhookPayload<MessagePayload>) {
    try {
      await this.supportChatsService.onMessageAck(payload);
    } catch (error) {
      this.logger.error('Erro ao processar mensagens ack do WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('whatsapp.message_reaction')
  async onMessageReaction(payload: WhatsappWebhookPayload<ReactionPayload>) {
    try {
      await this.supportChatsService.onMessageReaction(payload);
    } catch (error) {
      this.logger.error('Erro ao processar reação de mensagem do WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('whatsapp.message_edit')
  async onMessageEdit(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    try {
      await this.supportChatsService.onMessageEdit(payload);
    } catch (error) {
      this.logger.error('Erro ao processar edição de mensagem do WhatsApp:', error);
      throw error;
    }
  }
  @OnEvent('whatsapp.message_revoke_everyone')
  async onMessageRevokeEveryone(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    try {
      await this.supportChatsService.onMessageRevokeEveryone(payload);
    } catch (error) {
      this.logger.error('Erro ao processar revogação de mensagem do WhatsApp:', error);
      throw error;
    }
  }
}
