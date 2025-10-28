import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { ChannelStatus, GetClientInfoResponse, WhatsappWebhookPayload } from '@types';
import { ChannelsRepository } from './channels.repository';
import { WhatsappGateway } from 'whatsapp/whatsapp.gateway';

@Injectable()
export class ChannelsListener {
  private readonly logger = new Logger(ChannelsListener.name);

  constructor(
    // @ts-ignore
    private readonly whatsappGateway: WhatsappGateway,
    private readonly channelsRepository: ChannelsRepository,
  ) {}

  @OnEvent('whatsapp.session_started', { async: true })
  async sessionStarted(payload: WhatsappWebhookPayload) {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      await this.channelsRepository.update(channel.id, {
        channel_status_id: ChannelStatus.CONNECTING,
      });
      this.whatsappGateway.emitEvent('whatsapp:channel_status', { channel_id: channel.id });
    } catch (error) {
      this.logger.error('Erro ao processar início de sessão do canal WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('whatsapp.qr_code_received')
  async qrCodeReceived(payload: WhatsappWebhookPayload<{ qr: string }>) {
    // @ts-ignore
    const {
      sessionId,
      data: { qr },
    } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    if (channel.channel_status_id !== ChannelStatus.CONNECTING) {
      return;
    }

    try {
      await this.channelsRepository.update(channel.id, {
        qr_code: qr,
        channel_status_id: ChannelStatus.CONNECTING,
      });
      this.whatsappGateway.emitEvent('whatsapp:channel_status', { channel_id: channel.id });
    } catch (error) {
      this.logger.error('Erro ao processar QR Code recebido do canal WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('whatsapp.authenticated')
  async channelAuthenticated(payload: WhatsappWebhookPayload, clientInfo: GetClientInfoResponse) {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      await this.channelsRepository.update(channel.id, {
        qr_code: null,
        connected_at: new Date(),
        disconnected_at: null,
        channel_status_id: ChannelStatus.CONNECTED,
        phone_number: clientInfo.sessionInfo.wid.user.slice(-10),
      });
      this.whatsappGateway.emitEvent('whatsapp:channel_status', { channel_id: channel.id });
    } catch (error) {
      this.logger.error('Erro ao processar autenticação do canal WhatsApp:', error);
      throw error;
    }
  }

  @OnEvent('whatsapp.disconnected')
  async channelDisconnected(payload: WhatsappWebhookPayload<{ reason: string }>) {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      await this.channelsRepository.update(channel.id, {
        qr_code: null,
        disconnected_at: new Date(),
        connected_at: null,
        channel_status_id: ChannelStatus.DISCONNECTED,
        phone_number: null,
      });
      this.whatsappGateway.emitEvent('whatsapp:channel_status', { channel_id: channel.id });
    } catch (error) {
      this.logger.error('Erro ao processar desconexão do canal WhatsApp:', error);
      throw error;
    }
  }
}
