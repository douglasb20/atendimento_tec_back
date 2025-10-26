import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';

import { WhatsappGateway } from './whatsapp.gateway';
import { SessionStartResponse, QrCodeResponse, ErrorResponse, WhatsappWebhookPayload, DataTypeWhatsapp } from '@types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly whatsappGateway: WhatsappGateway,
    private readonly eventEmitter: EventEmitter2,
  ) { }
  
  async processWebhook(payload: WhatsappWebhookPayload) {
    this.logger.log('Processando webhook do WhatsApp...');
    try {
      const { dataType } = payload;

      switch (dataType) {
        case DataTypeWhatsapp.MESSAGE_CREATE:
        case DataTypeWhatsapp.MESSAGE_EDIT:
        case DataTypeWhatsapp.MESSAGE_ACK:
        case DataTypeWhatsapp.MESSAGE_REACTION:
          this.eventEmitter.emit('whatsapp.message', payload);
          break;
      }
      this.whatsappGateway.emitEvent('whatsapp:message', payload);
    } catch (error) {
      this.logger.error('Erro ao processar webhook do WhatsApp:', error);
    }
  }

  async requestConnection(sessionId: string) {
    try {
      const urlStatus = `${process.env.URL_WHATSAPP_API}/session/status/${sessionId}`;
      const { data: statusData } = await axios.get<SessionStartResponse>(urlStatus);

      if (!statusData.success) {
        if (statusData.message === 'session_not_found') {
          const urlStart = `${process.env.URL_WHATSAPP_API}/session/start/${sessionId}`;
          const { data } = await axios.get<SessionStartResponse>(urlStart);

          if (!data.success) {
            this.logger.log(`Falha ao iniciar sessão para o WhatsApp: ${(data as unknown as ErrorResponse).error}`);
            throw new InternalServerErrorException(`Falha ao iniciar sessão para o WhatsApp: ${(data as unknown as ErrorResponse).error}`);
          }
          this.logger.log(`Sessão do WhatsApp iniciada com sucesso: ${data.message}`);
        }
      }
    } catch (error) {
      this.logger.error('Erro ao solicitar conexão do WhatsApp:', error.response?.data.error || error.message);
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async requestQrCode(sessionId: string) {
    try {
      const url = `${process.env.URL_WHATSAPP_API}/session/qr/${sessionId}`;
      const { data: qrCodeData } = await axios.get<QrCodeResponse>(url);

      console.log(qrCodeData);

      if (!qrCodeData.success) {
        // this.logger.log(`Falha ao gerar QR Code para o WhatsApp: ${(qrCodeData as unknown as ErrorResponse).error}`);
        throw new InternalServerErrorException(`Falha ao gerar QR Code para o WhatsApp: ${(qrCodeData as unknown as ErrorResponse).error}`);
      }

      this.logger.log(`QR Code gerado com sucesso: ${qrCodeData.qr}`);

      return qrCodeData.qr;

    } catch (error) {
      this.logger.error('Erro ao solicitar conexão do WhatsApp:', error.response?.data.error || error.message);
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async requestDisconnection(sessionId: string) {
    console.log('Desconectando sessão do WhatsApp:', sessionId);
  }

  async sendMessage(sessionId: string, to: string, message: string) {
    this.logger.log(`Enviando mensagem para ${to}`);
    const dataPost = {
      chatId: to,
      contentType: 'string',
      content: message,
    };

    const url = `${process.env.URL_WHATSAPP_API}/client/sendMessage/${sessionId}`;
    try {
      const response = await axios.post(url, dataPost);
      this.logger.log(`Mensagem enviada com sucesso: ${response.data}`);
    } catch (error) {
      this.logger.error('Falha ao enviar mensagem:', error.response?.data || error.message);
      throw new Error('Não foi possível enviar a mensagem.');
    }
  }
}
