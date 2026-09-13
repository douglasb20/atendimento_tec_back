import { SupportChatsService } from '@/support-chats/support-chats.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { DataTypeWhatsapp, WhatsappWebhookPayload } from '@types';
import { Job } from 'bullmq';

@Processor('whatsapp-messages-queue', { concurrency: 1 })
export class WhatsappMessagesProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappMessagesProcessor.name);

  @Inject()
  private readonly supportChatsService: SupportChatsService;

  async process(job: Job<WhatsappWebhookPayload<any>>): Promise<boolean> {
    const payload = job.data;

    try {
      this.logger.log(`Processando evento WhatsApp: ${payload.dataType}`);

      switch (payload.dataType) {
        case DataTypeWhatsapp.MESSAGE_CREATE:
          await this.supportChatsService.onMessageCreate(payload);
          break;

        case DataTypeWhatsapp.MESSAGE_ACK:
          await this.supportChatsService.onMessageAck(payload);
          break;

        case DataTypeWhatsapp.MESSAGE_EDIT:
          await this.supportChatsService.onMessageEdit(payload);
          break;

        case DataTypeWhatsapp.MESSAGE_REACTION:
          await this.supportChatsService.onMessageReaction(payload);
          break;

        case DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE:
          await this.supportChatsService.onMessageRevokeEveryone(payload);
          break;

        // `chats.update` não é mais roteado (ver `resolveDataType`): chega sem
        // `unreadCount` e identificado por `@lid`. A contagem é mantida por
        // nós, no recebimento da mensagem e na abertura da conversa.
      }

      return true;
    } catch (error) {
      this.logger.error('Erro ao processar evento WhatsApp via Bull:', error);
      throw error;
    }
  }
}
