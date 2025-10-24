import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AtendimentoChatService {
  private readonly logger = new Logger(AtendimentoChatService.name);
  private readonly sessionId: string = 'f8377d8d-a589-4242-9ba6-9486a04ef80c'; // Mova para .env 


  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem para ${to}`);
    const dataPost = {
      chatId: to,
      contentType: 'string',
      content: message,
    };

    const url = `${process.env.URL_WHATSAPP_API}/client/sendMessage/${this.sessionId}`;
    try {
      const response = await axios.post(url, dataPost);
      this.logger.log(`Mensagem enviada com sucesso: ${response.data}`);
    } catch (error) {
      this.logger.error('Falha ao enviar mensagem:', error.response?.data || error.message);
      throw new Error('Não foi possível enviar a mensagem.');
    }
  }
}
