import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AtendimentoChatService {
  private readonly logger = new Logger(AtendimentoChatService.name);

  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${to} com mensage: ${message}`);
  }
}
