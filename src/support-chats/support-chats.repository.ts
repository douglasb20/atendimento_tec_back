import { Injectable } from '@nestjs/common';
import { MessageWithLastMessage } from '@types';
import { DataSource, Repository } from 'typeorm';
import { SupportChats } from './entities/support-chats.entity';

@Injectable()
export class SupportChatsRepository extends Repository<SupportChats> {
  constructor(dataSource: DataSource) {
    super(SupportChats, dataSource.manager);
  }

  async findActives() {
    return this.findBy({ support_chat_status_id: 1 });
  }

  async updateLastMessage(
    support_chat_id: number,
    lastMessage: MessageWithLastMessage['lastMessage'],
  ) {
    if (!lastMessage) {
      return;
    }

    await this.update(support_chat_id, {
      last_message: lastMessage.content,
      last_message_type: lastMessage.type,
      last_message_id: lastMessage.id,
    });
  }
}
