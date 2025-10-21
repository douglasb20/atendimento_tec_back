import { Injectable, Logger } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
// import { Repository } from 'typeorm';
import { WhatsappGateway } from './whatsapp.gateway';
// import { WhatsappMessage } from './entities/whatsapp-message.entity';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  
  private readonly sessionId: string = 'f8377d8d-a589-4242-9ba6-9486a04ef80c'; // Mova para .env

  constructor(
    // @InjectRepository(WhatsappMessage)
    // private readonly messageRepository: Repository<WhatsappMessage>,
    private readonly whatsappGateway: WhatsappGateway,
  ) {}

  async processWebhook(payload: any) {
    this.logger.log('Processando webhook do WhatsApp...');
    
    // Exemplo de como extrair dados (ajuste conforme o payload real)
    // const messageData = {
    //   message_id: payload.id,
    //   sender: payload.from,
    //   receiver: payload.to,
    //   content: payload.body,
    //   payload: payload, // Salva o payload completo
    // };

    try {
      // 1. Salvar a mensagem no banco de dados
      // const newMessage = this.messageRepository.create(messageData);
      // await this.messageRepository.save(newMessage);
      // this.logger.log(`Mensagem ${newMessage.id} salva no banco.`);

      // 2. Emitir o evento via WebSocket para o frontend
      this.whatsappGateway.emitEvent('whatsapp:message', payload);
    } catch (error) {
      this.logger.error('Falha ao processar webhook:', error.message);
    }
  }

  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem para ${to}`);
    
    const dataPost = {
      chatId: to,
      contentType: 'string',
      content: message,
    };

    const url = `${process.env.URL_WHATSAPP_API}/client/sendMessage/${this.sessionId}`;
    
    try {
      await axios.post(url, dataPost);
      this.logger.log('Mensagem enviada com sucesso.');
    } catch (error) {
      this.logger.error('Falha ao enviar mensagem:', error.response?.data || error.message);
      throw new Error('Não foi possível enviar a mensagem.');
    }
  }
}