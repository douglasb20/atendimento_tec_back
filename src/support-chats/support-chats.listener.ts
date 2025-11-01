import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WhatsappWebhookPayload } from '@types';
import { sleep } from 'Utils';
import { WhatsappGateway } from 'whatsapp/whatsapp.gateway';

@Injectable()
export class SupportChatsListener {
  private readonly logger = new Logger(SupportChatsListener.name);

  constructor(
    // @ts-ignore
    private readonly whatsappGateway: WhatsappGateway,
  ) {}

  @OnEvent('whatsapp.messages', { async: true })
  async handleWhatsappMessages(payload: WhatsappWebhookPayload) {
    try {
      this.whatsappGateway.emitEvent('whatsapp:messages', payload);
    } catch (error) {
      this.logger.error('Erro ao processar mensagens do WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('teste1')
  async teste1() {
    await sleep(5);
    console.log('Evento de status de mensagem recebido 1');
  }

  @OnEvent('teste2')
  async teste2() {
    await sleep(5);
    console.log('Evento de status de mensagem recebido 2');
  }

  @OnEvent('teste3')
  async teste3() {
    await sleep(5);
    console.log('Evento de status de mensagem recebido 3');
  }
}
