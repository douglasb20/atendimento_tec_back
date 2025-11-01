import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelsRepository } from 'channels/channels.repository';
import { Channels } from 'channels/entities/channels.entity';
import { Users } from 'users/entities/users.entity';
import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { SupportChatsController } from './support-chats.controller';
import { SupportChatsListener } from './support-chats.listener';
import { SupportChatsRepository } from './support-chats.repository';
import { SupportChatsService } from './support-chats.service';
import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { SupportChatStatus } from './entities/support-chat-status.entity';
import { SupportChats } from './entities/support-chats.entity';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportChats,
      SupportChatMessages,
      SupportChatStatus,
      Channels,
      Users,
    ]),
    WhatsappModule,
    MessagesModule,
  ],
  controllers: [SupportChatsController],
  providers: [
    ChannelsRepository,
    SupportChatsService,
    SupportChatsRepository,
    SupportChatsListener,
  ],
})
export class SupportChatModule {}
