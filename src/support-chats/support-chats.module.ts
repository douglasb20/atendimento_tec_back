import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelsModule } from 'channels/channels.module';
import { ContactsModule } from 'contacts/contacts.module';
import { Users } from 'users/entities/users.entity';
import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { SupportChatMessages } from './messages/entities/support-chat-messages.entity';
import { SupportChatStatus } from './entities/support-chat-status.entity';
import { SupportChats } from './entities/support-chats.entity';
import { MessagesModule } from './messages/messages.module';
import { ProtocolCountersRepository } from './protocol-counters.repository';
import { SupportChatsController } from './support-chats.controller';
import { SupportChatsListener } from './support-chats.listener';
import { SupportChatsRepository } from './support-chats.repository';
import { SupportChatsService } from './support-chats.service';
import { ProtocolCounters } from './entities/protocol-counters.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportChats,
      SupportChatMessages,
      SupportChatStatus,
      Users,
      ProtocolCounters,
    ]),
    WhatsappModule,
    MessagesModule,
    ContactsModule,
    MessagesModule,
    ChannelsModule,
  ],
  controllers: [SupportChatsController],
  providers: [
    SupportChatsService,
    SupportChatsRepository,
    SupportChatsListener,
    ProtocolCountersRepository,
  ],
  exports: [SupportChatsService],
})
export class SupportChatModule {}
