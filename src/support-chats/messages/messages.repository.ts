import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SupportChatMessages } from './entities/support-chat-messages.entity';

@Injectable()
export class MessagesRepository extends Repository<SupportChatMessages> {
  constructor(dataSource: DataSource) {
    super(SupportChatMessages, dataSource.manager);
  }
}
