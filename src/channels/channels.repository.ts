import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Channels } from './entities/channels.entity';

@Injectable()
export class ChannelsRepository extends Repository<Channels> {
  private readonly logger = new Logger(ChannelsRepository.name);
  constructor(dataSource: DataSource) {
    super(Channels, dataSource.manager);
  }

  async findActives() {
    this.logger.log('Initializing ChannelsRepository');
    return this.findBy({ channel_status_id: 1 });
  }
}
