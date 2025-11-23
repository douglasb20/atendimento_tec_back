import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SupportChatMessages } from './entities/support-chat-messages.entity';

@Injectable()
export class MessagesRepository extends Repository<SupportChatMessages> {
  constructor(dataSource: DataSource) {
    super(SupportChatMessages, dataSource.manager);
  }

  async findOneBySupportChatIdAndMessageId(
    support_chat_id: number,
    message_id: string,
  ): Promise<SupportChatMessages | null> {
    return this.findOneBy({
      support_chat_id,
      message_id,
    });
  }
}
