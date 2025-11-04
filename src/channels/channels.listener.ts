
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { WhatsappWebhookPayload } from '@types';
import { ChannelsService } from './channels.service';

@Injectable()
export class ChannelsListener {

  constructor(
    private readonly channelsService: ChannelsService,
  ) {}

  @OnEvent('whatsapp.session_started')
  async sessionStarted(payload: WhatsappWebhookPayload) {
    const { sessionId } = payload;
    await this.channelsService.handleSessionStarted(sessionId);
  }

  @OnEvent('whatsapp.qr_code_received')
  async qrCodeReceived(payload: WhatsappWebhookPayload<{ qr: string }>) {
    await this.channelsService.handleQrCodeReceived(payload);
  }

  @OnEvent('whatsapp.authenticated')
  async channelAuthenticated(payload: WhatsappWebhookPayload) {
    await this.channelsService.handleChannelAuthenticated(payload); 
  }

  @OnEvent('whatsapp.disconnected')
  async channelDisconnected(payload: WhatsappWebhookPayload<{ reason: string }>) {
    await this.channelsService.handleChannelDisconnected(payload);
  }

  @OnEvent('whatsapp.ready')
  async channelReady(payload: WhatsappWebhookPayload) {
    await this.channelsService.handleChannelReady(payload);
  }
}
