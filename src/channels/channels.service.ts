import { runInTransaction } from '@/Utils';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelStatus, WhatsappWebhookPayload } from '@types';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { WhatsappService } from 'whatsapp/whatsapp.service';
import { ChannelsRepository } from './channels.repository';
import { CreateOrChannelDto } from './dto/create-or-channel.dto';
import { Channels } from './entities/channels.entity';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly whatsappService: WhatsappService,
    private dataSource: DataSource,
  ) {}

  async getActiveChannels(): Promise<Channels[]> {
    const channels = await this.channelsRepository.findActives();
    return channels;
  }

  async getChannelBySessionId(sessionId: string): Promise<Channels> {
    const channel = await this.channelsRepository.findBySessionId(sessionId);
    return channel;
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

    // garante que exista um session_id
    if (!channel.session_id) {
      await this.channelsRepository.update(channel.id, { session_id: randomUUID().toUpperCase() });
      const reloaded = await this.channelsRepository.findOneBy({ id: channel.id });
      channel.session_id = reloaded!.session_id;
    }

    await this.whatsappService.requestConnection(channel.session_id);
    const qrCode = await this.whatsappService.requestQrCode(channel.session_id);

    if (qrCode) {
      await this.channelsRepository.update(channel.id, { qr_code: qrCode });
    }
  }

  async closeSession(channelId: number) {
    const channel = await this.findChannel(channelId);
    if (!channel) {
      throw new NotFoundException('Canal não localizado com este id');
    }

    if (!channel.session_id) {
      return; // nada a fazer
    }

    await this.whatsappService.requestDisconnection(channel.session_id);
  }

  // ====== Events Listener Methods ======

  handleChannelStatus(channel_id: number): void {
    this.whatsappService.emitEvent('whatsapp:channel_status', { channel_id });
  }

  async handleSessionStarted(sessionId: string): Promise<void> {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const channel = await this.channelsRepository.findBySessionId(sessionId);
        await manager.update(Channels, channel.id, {
          channel_status_id: ChannelStatus.CONNECTING,
        });
        this.handleChannelStatus(channel.id);
      } catch (error) {
        this.logger.error('Erro ao processar início de sessão do canal WhatsApp:', error);
        throw error;
      }
    });
  }

  async handleQrCodeReceived(payload: WhatsappWebhookPayload<{ qr: string }>): Promise<void> {
    const {
      sessionId,
      data: { qr },
    } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    if (channel.channel_status_id !== ChannelStatus.CONNECTING) {
      return;
    }
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        await manager.update(Channels, channel.id, {
          qr_code: qr,
          channel_status_id: ChannelStatus.CONNECTING,
        });
        this.handleChannelStatus(channel.id);
      } catch (error) {
        this.logger.error('Erro ao processar QR Code recebido do canal WhatsApp:', error);
        throw error;
      }
    });
  }

  async handleChannelAuthenticated(payload: WhatsappWebhookPayload): Promise<void> {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      await this.channelsRepository.update(channel.id, {
        qr_code: null,
        connected_at: new Date(),
        disconnected_at: null,
        channel_status_id: ChannelStatus.CONNECTED,
      });
      this.handleChannelStatus(channel.id);
    } catch (error) {
      this.logger.error('Erro ao processar autenticação do canal WhatsApp:', error);
      throw error;
    }
  }

  async handleChannelReady(payload: WhatsappWebhookPayload): Promise<void> {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      if (channel.channel_status_id === ChannelStatus.CONNECTED && channel.phone_number === null) {
        const clientInfo = await this.whatsappService.getClientInfo(sessionId);
        if (clientInfo) {
          await this.channelsRepository.update(channel.id, {
            phone_number: clientInfo.sessionInfo.wid.user.slice(-10),
          });
        }
        this.handleChannelStatus(channel.id);
      }
    } catch (error) {
      this.logger.error('Erro ao processar autenticação do canal WhatsApp:', error);
      throw error;
    }
  }

  async handleChannelDisconnected(
    payload: WhatsappWebhookPayload<{ reason: string }>,
  ): Promise<void> {
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
      this.handleChannelStatus(channel.id);
    } catch (error) {
      this.logger.error('Erro ao processar desconexão do canal WhatsApp:', error);
      throw error;
    }
  }
}
