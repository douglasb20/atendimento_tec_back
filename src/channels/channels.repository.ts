import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Not, Repository } from 'typeorm';
import { Channels } from './entities/channels.entity';

@Injectable()
export class ChannelsRepository extends Repository<Channels> {
  private readonly logger = new Logger(ChannelsRepository.name);
  constructor(dataSource: DataSource) {
    super(Channels, dataSource.manager);
  }

  async findActives() {
    return this.find({
      where: { channel_status_id: Not(5), deleted_at: null },
      relations: ['channelStatus'],
    });
  }

  async findBySessionId(session_id: string, emitError = true) {
    const channel = await this.findOne({ where: { session_id }, relations: ['channelStatus'] });
    if (!channel) {
      this.logger.error(`Canal não encontrado com session_id: ${session_id}`);
      if (emitError) {
        throw new NotFoundException(`Canal não encontrado com session_id: ${session_id}`);
      }
    }
    return channel;
  }
}
