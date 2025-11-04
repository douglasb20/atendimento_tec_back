import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from 'whatsapp/whatsapp.service';
import { MessagesService } from './messages/messages.service';
import { ChannelsRepository } from 'channels/channels.repository';
import { WhatsappWebhookPayload } from '@types';

@Injectable()
export class SupportChatsService {
  private readonly logger = new Logger(SupportChatsService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly messagesService: MessagesService,
    private readonly channelsRepository: ChannelsRepository
  ) {}

  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${to} com mensagem: ${message}`);
    this.whatsappService.sendMessage('1', to, message);
  }

  async onMessageCreate(payload: WhatsappWebhookPayload) {
    try{
      const { sessionId, data } = payload;
      const channel = await this.channelsRepository.findBySessionId(sessionId);
      console.log('Canal encontrado:', data, channel);

    }catch(err){

    }
  }

  async test() {
    return this.messagesService.hello();
  }
}
