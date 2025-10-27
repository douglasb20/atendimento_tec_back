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
    return this.findBy({ channel_status_id: Not(5), deleted_at: null });
  }

  async findBySessionId(session_id: string) {
    const channel = await this.findOneBy({ session_id });
    if (!channel) {
      this.logger.error(`Canal não encontrado com session_id: ${session_id}`);
      throw new NotFoundException(`Canal não encontrado com session_id: ${session_id}`);
    }
    return channel;
  }
}
