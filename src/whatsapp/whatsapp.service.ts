import { Injectable, Logger } from '@nestjs/common';

import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly whatsappGateway: WhatsappGateway) { }
  async processWebhook(payload: any) {
    this.logger.log('Processando webhook do WhatsApp...');
    try {

      this.whatsappGateway.emitEvent('whatsapp:message', payload);
    } catch (error) {
      this.logger.error('Erro ao processar webhook do WhatsApp:', error);
    }
  }

  
}
