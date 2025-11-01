import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WhatsappService } from 'whatsapp/whatsapp.service';
import { ChannelsRepository } from './channels.repository';
import { CreateOrChannelDto } from './dto/create-or-channel.dto';
import { ChannelStatus } from '@types';
import { Channels } from './entities/channels.entity';

// import { QueryRunner } from 'typeorm';

@Injectable()
export class ChannelsService {
  // private queryRunner: QueryRunner;
  private readonly logger = new Logger(ChannelsService.name);
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly whatsappService: WhatsappService,
  ) {}

  async getActiveChannels(): Promise<Channels[]> {
    return this.channelsRepository.findActives();
  }

  async createChannel(createChannelDto: CreateOrChannelDto): Promise<Channels> {
    const channel = this.channelsRepository.create({
      ...createChannelDto,
    });

    await this.channelsRepository.save(channel);
    return channel;
  }

  async updateChannel(channelId: number, createChannelDto: CreateOrChannelDto): Promise<Channels> {
    const channel = await this.findChannel(channelId);
    const channelUpdated = this.channelsRepository.create({
      ...channel,
      ...createChannelDto,
    });
    await this.channelsRepository.save(channelUpdated);
    return channel;
  }

  async removeChannel(channelId: number): Promise<void> {
    const channel = await this.findChannel(channelId);
    const channelRemoved = this.channelsRepository.create({
      ...channel,
      channel_status_id: ChannelStatus.DELETED,
      deleted_at: new Date(),
    });
    await this.channelsRepository.save(channelRemoved);
  }

  async findChannel(channelId: number): Promise<Channels> {
    const channel = await this.channelsRepository.findOneBy({ id: channelId });
    if (!channel) {
      this.logger.error(`Erro ao localizar canal: Canal não encontrado com este id`);
      throw new NotFoundException('Canal não encontrado com este id');
    }
    return channel;
  }

  async startSession(channelId: number): Promise<void> {
    const channel = await this.findChannel(channelId);
    if (!channel) {
      throw new NotFoundException('Canal não localizado com este id');
    }

    await this.whatsappService.requestConnection(channel.session_id);
    const qrCode = await this.whatsappService.requestQrCode(channel.session_id);

    if (qrCode) {
      this.channelsRepository.update(channel.id, { qr_code: qrCode });
    }
  }

  async closeSession(channelId: number) {
    const channel = await this.findChannel(channelId);
    if (!channel) {
      throw new NotFoundException('Canal não localizado com este id');
    }

    await this.whatsappService.requestDisconnection(channel.session_id);
  }

  // ====== Webhook Processing ======
}
