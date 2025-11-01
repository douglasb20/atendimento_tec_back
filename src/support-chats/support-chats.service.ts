import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from 'whatsapp/whatsapp.service';
import { MessagesService } from './messages/messages.service';

@Injectable()
export class SupportChatsService {
  private readonly session_id = '93F181D4-B133-11F0-AF75-C423607D461D';
  private readonly logger = new Logger(SupportChatsService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly messagesService: MessagesService,
  ) {}

  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${to} com mensagem: ${message}`);
    this.whatsappService.sendMessage(this.session_id, to, message);
  }

  async test() {
    return this.messagesService.hello();
  }
}
