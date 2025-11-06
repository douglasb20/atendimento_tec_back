import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SupportChats } from './entities/support-chats.entity';
import { SupportChatMessages } from './messages/entities/support-chat-messages.entity';

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

  async updateLastMessage(support_chat_id: number, lastMessage: SupportChatMessages) {
    this.logger.log(`Updating last message for support chat ID: ${support_chat_id}`);

    let lastMessageContent = '';
    if (lastMessage.type === 'chat' && lastMessage.from_me) {
      lastMessageContent = `*Você:* ${lastMessage.content}`;
    } else {
      lastMessageContent = lastMessage.content;
    }

    await this.update(support_chat_id, {
      last_message: lastMessageContent,
    });
  }
}
