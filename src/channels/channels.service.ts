import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelsRepository } from './channels.repository';
import { WhatsappService } from 'whatsapp/whatsapp.service';
// import { QueryRunner } from 'typeorm';

@Injectable()
export class ChannelsService {
  // private queryRunner: QueryRunner;
  private readonly logger = new Logger(ChannelsService.name);
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly whatsappService: WhatsappService,
  ) {}

  async getActiveChannels() {
    return this.channelsRepository.findActives();
  }

  async startSession(channelId: number) {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) {
      this.logger.error(`Erro de conectar canal: Canal não localizado com este id`);
      throw new NotFoundException('Canal não localizado com este id');
    }

    await this.whatsappService.requestConnection(channel.session_id);
    await this.requestQrCode(channelId);
  }

  async requestQrCode(channelId: number) {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) {
      this.logger.error(`Erro ao solicitar QR Code: Canal não localizado com este id`);
      throw new NotFoundException('Canal não localizado com este id');
    }
  }

  // ====== Webhook Processing ======

  async qrCodeReceived(sessionId: string, qrCode: string) {
    const channel = await this.channelsRepository.findOneBy({ session_id: sessionId });
    if (!channel) {
      this.logger.error(`Erro ao receber QR Code: Canal não localizado com este id`);
      throw new NotFoundException('Canal não localizado com este id');
    }

    await this.channelsRepository.update({ session_id: sessionId }, { qr_code: qrCode, channel_status_id: 2 });
  }
}
