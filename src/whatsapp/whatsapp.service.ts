import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios, { AxiosInstance } from 'axios';

import { InjectQueue } from '@nestjs/bullmq';
import {
  DataTypeWhatsapp,
  ErrorResponse,
  GenericResponse,
  GetClientInfoResponse,
  MessageMedia,
  MessageMediaResponse,
  QrCodeResponse,
  ResultResponse,
  SessionStartResponse,
  WhatsappWebhookPayload,
} from '@types';
import { Queue } from 'bullmq';
import { sleep } from 'Utils';
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private axiosInstance: AxiosInstance;

  constructor(
    @InjectQueue('whatsapp-messages-queue')
    private readonly messagesQueue: Queue<WhatsappWebhookPayload>,
    @InjectQueue('whatsapp-session-queue')
    private readonly sessionQueue: Queue<WhatsappWebhookPayload>,
    private readonly eventEmitter: EventEmitter2,
    private readonly whatsappGateway: WhatsappGateway,
  ) {
    this.axiosInstance = axios.create({
      baseURL: process.env.URL_WHATSAPP_API,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.WHATSAPP_API_KEY || '',
      },
    });
  }

  private getChatKey(payload: WhatsappWebhookPayload<any>): string | null {
    const { sessionId, data, dataType } = payload;
    let remoteJid: string;

    switch (dataType) {
      case DataTypeWhatsapp.MESSAGE_CREATE:
      case DataTypeWhatsapp.MESSAGE_ACK:
      case DataTypeWhatsapp.MESSAGE_EDIT:
        remoteJid = data.message?.id?.remote;
        break;
      case DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE:
        remoteJid = data.message?.protocolMessageKey?.remote;
        break;
      case DataTypeWhatsapp.MESSAGE_REACTION:
        remoteJid = data.reaction?.msgId?.remote;
        break;
      case DataTypeWhatsapp.UNREAD_COUNT:
        remoteJid = data.chat?.id?._serialized;
        break;
    }

    if (!remoteJid) return `${sessionId}-system_${Date.now()}`;
    return `${sessionId}-${remoteJid}_${Date.now()}`;
  }

  async processWebhook(payload: WhatsappWebhookPayload) {
    this.logger.log(`Processando webhook do WhatsApp: ${payload.dataType}...`);
    const key = this.getChatKey(payload);

    switch (payload.dataType) {
      case DataTypeWhatsapp.QR_RECEIVED:
      case DataTypeWhatsapp.AUTHENTICATED:
      case DataTypeWhatsapp.READY:
        await this.sessionQueue.add(`whatsapp-session-${payload.sessionId}`, payload, {
          jobId: key,
        });
        break;
      case DataTypeWhatsapp.MESSAGE_CREATE:
      case DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE:
      case DataTypeWhatsapp.MESSAGE_EDIT:
      case DataTypeWhatsapp.MESSAGE_REACTION:
      case DataTypeWhatsapp.MESSAGE_ACK:
      case DataTypeWhatsapp.UNREAD_COUNT:
        await this.messagesQueue.add(`whatsapp-message-${payload.sessionId}`, payload, {
          jobId: key,
        });
        break;
    }

    this.logger.log(`Evento enfileirado: ${payload.dataType} para a key ${key}`);
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

  async getProfilePicUrl(sessionId: string, remoteJid: string): Promise<string> {
    try {
      const url = `/contact/getProfilePicUrl/${sessionId}`;
      const dataPost = {
        contactId: remoteJid,
      };
      const { data: response } = await this.axiosInstance.post<GenericResponse<string>>(
        url,
        dataPost,
      );
      return response.result;
    } catch (error) {
      this.logger.error(
        'Erro ao obter URL da foto de perfil do WhatsApp:',
        error.response?.data.error || error.message,
      );
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async getFormattedNumber(sessionId: string, remote_jid: string): Promise<string> {
    try {
      const url = `/contact/getFormattedNumber/${sessionId}`;

      const dataPost = {
        contactId: remote_jid,
      };

      const { data } = await this.axiosInstance.post<ResultResponse & { result: string }>(
        url,
        dataPost,
      );
      const formattedNumber = data.result;
      const phone = formattedNumber.split(' ').slice(1).join('').replace('-', '');
      return phone;
    } catch (error) {
      this.logger.error(
        'Erro ao obter número formatado do WhatsApp:',
        error.response?.data.error || error.message,
      );
      throw new InternalServerErrorException('Falha ao se comunicar com a API do WhatsApp.');
    }
  }

  async downloadMedia(sessionId: string, messageId: string, chatId: string): Promise<MessageMedia> {
    const url = `/message/downloadMedia/${sessionId}`;

    const dataPost = {
      chatId,
      messageId,
    };

    const { data } = await this.axiosInstance.post<MessageMediaResponse>(url, dataPost);
    return data.messageMedia;
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
      await this.axiosInstance.post(url, dataPost);
      this.logger.log(`Mensagem enviada com sucesso`);
    } catch (error) {
      this.logger.error('Falha ao enviar mensagem:', error.response?.data || error.message);
      throw new Error('Não foi possível enviar a mensagem.');
    }
  }
}
