import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';

import {
  DataTypeWhatsapp,
  ErrorResponse,
  GetClientInfoResponse,
  QrCodeResponse,
  SessionStartResponse,
  WhatsappWebhookPayload,
} from '@types';
import { sleep } from 'Utils';
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private axiosInstance: AxiosInstance;

  constructor(private readonly eventEmitter: EventEmitter2, private readonly whatsappGateway: WhatsappGateway) {
    this.axiosInstance = axios.create({
      baseURL: process.env.URL_WHATSAPP_API,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.WHATSAPP_API_KEY || '',
      },
    });
  }

  async processWebhook(payload: WhatsappWebhookPayload) {
    this.logger.log('Processando webhook do WhatsApp...');
    const { dataType } = payload;

    switch (dataType) {
      case DataTypeWhatsapp.MESSAGE_CREATE:
        this.eventEmitter.emit('whatsapp.message_create', payload);
        break;
      case DataTypeWhatsapp.MESSAGE_EDIT:
      case DataTypeWhatsapp.MESSAGE_ACK:
      case DataTypeWhatsapp.MESSAGE_REACTION:
      case DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE:
        // this.eventEmitter.emit('whatsapp.messages', payload);
        break;
      case DataTypeWhatsapp.QR_RECEIVED:
        this.eventEmitter.emit('whatsapp.qr_code_received', payload); // channels.listener
        break;
      case DataTypeWhatsapp.AUTHENTICATED:
        this.eventEmitter.emit('whatsapp.authenticated', payload); // channels.listener
      case DataTypeWhatsapp.READY:
        this.eventEmitter.emit('whatsapp.ready', payload); // channels.listener
        break;
      case DataTypeWhatsapp.DISCONNECTED:
        this.eventEmitter.emit('whatsapp.disconnected', payload); // channels.listener
        break;
    }
    // this.whatsappGateway.emitEvent('whatsapp:message', payload);
  }

  emitEvent(event: string, payload: any) {
    this.whatsappGateway.emitEvent(event, payload);
  }

  async requestConnection(sessionId: string) {
    try {
      const urlStatus = `/session/status/${sessionId}`;
      const { data: statusData } = await this.axiosInstance.get<SessionStartResponse>(urlStatus);

      if (!statusData.success) {
        if (statusData.message === 'session_not_found') {
          const urlStart = `/session/start/${sessionId}`;
          const { data } = await this.axiosInstance.get<SessionStartResponse>(urlStart);

          if (!data.success) {
            this.logger.log(
              `Falha ao iniciar sessão para o WhatsApp: ${(data as unknown as ErrorResponse).error}`,
            );
            throw new InternalServerErrorException(
              `Falha ao iniciar sessão para o WhatsApp: ${(data as unknown as ErrorResponse).error}`,
            );
          }
          this.logger.log(`Sessão do WhatsApp iniciada com sucesso: ${data.message}`);
        }
        this.eventEmitter.emit('whatsapp.session_started', { sessionId });
      }
    } catch (error) {
      this.logger.error(
        'Erro ao solicitar conexão do WhatsApp:',
        error.response?.data.error || error.message,
      );
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async requestQrCode(sessionId: string) {
    try {
      const url = `/session/qr/${sessionId}`;
      const { data: qrCodeData } = await this.axiosInstance.get<QrCodeResponse>(url);

      const MESSAGE_SESSION_NOT_FOUND = 'qr code not ready or already scanned';

      if (!qrCodeData.success && qrCodeData.message === MESSAGE_SESSION_NOT_FOUND) {
        return;
      }

      return qrCodeData.qr;
    } catch (error) {
      this.logger.error(
        'Erro ao solicitar conexão do WhatsApp:',
        error.response?.data.error || error.message,
      );
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async requestDisconnection(sessionId: string) {
    try {
      await sleep(5);
      const url = `/session/terminate/${sessionId}`;
      await this.axiosInstance.get<SessionStartResponse>(url);

      await this.eventEmitter.emitAsync('whatsapp.disconnected', { sessionId });
    } catch (error) {
      this.logger.error(
        'Erro ao solicitar desconexão do WhatsApp:',
        error.response?.data.error || error.message,
      );
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async getClientInfo(sessionId: string) {
    try {
      const url = `/client/getClassInfo/${sessionId}`;
      const { data: clientInfo } = await this.axiosInstance.get<GetClientInfoResponse>(url);
      return clientInfo;
    } catch (error) {
      this.logger.error(
        'Erro ao obter informações do cliente do WhatsApp:',
        error.response?.data.error || error.message,
      );
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async sendMessage(sessionId: string, to: string, message: string) {
    this.logger.log(`Enviando mensagem para ${to}`);
    const dataPost = {
      chatId: to,
      contentType: 'string',
      content: message,
    };

    const url = `/client/sendMessage/${sessionId}`;
    try {
      const response = await this.axiosInstance.post(url, dataPost);
      this.logger.log(`Mensagem enviada com sucesso: ${response.data}`);
    } catch (error) {
      this.logger.error('Falha ao enviar mensagem:', error.response?.data || error.message);
      throw new Error('Não foi possível enviar a mensagem.');
    }
  }
}
