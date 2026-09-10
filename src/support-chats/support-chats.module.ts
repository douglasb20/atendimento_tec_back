import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelsModule } from '@/channels/channels.module';
import { ContactsModule } from '@/contacts/contacts.module';
import { Users } from '@/users/entities/users.entity';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';

import { ProtocolCounters } from './entities/protocol-counters.entity';
import { SupportChatStatus } from './entities/support-chat-status.entity';
import { SupportChats } from './entities/support-chats.entity';
import { SupportChatMessages } from './messages/entities/support-chat-messages.entity';
import { MessagesModule } from './messages/messages.module';
import { ProtocolCountersRepository } from './protocol-counters.repository';
import { SupportChatsController } from './support-chats.controller';
import { SupportChatsRepository } from './support-chats.repository';
import { SupportChatsService } from './support-chats.service';
import { StorageModule } from '@/storage/storage.module';
import { RedisCacheModule } from '@/redis-cache/redis-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportChats,
      SupportChatMessages,
      SupportChatStatus,
      Users,
      ProtocolCounters,
    ]),
    forwardRef(() => WhatsappModule),
    forwardRef(() => ContactsModule),
    MessagesModule,
    ChannelsModule,
    StorageModule,
    RedisCacheModule,
  ],
  controllers: [SupportChatsController],
  providers: [SupportChatsService, SupportChatsRepository, ProtocolCountersRepository],
  exports: [SupportChatsService],
})
export class SupportChatsModule {}
