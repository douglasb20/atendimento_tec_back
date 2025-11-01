import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SupportChats } from './entities/support-chats.entity';

@Injectable()
export class SupportChatsRepository extends Repository<SupportChats> {
  private readonly logger = new Logger(SupportChatsRepository.name);
  constructor(dataSource: DataSource) {
    super(SupportChats, dataSource.manager);
  }

  async findActives() {
    this.logger.log('Initializing SupportChatsRepository');
    return this.findBy({ support_chat_status_id: 1 });
  }
}
