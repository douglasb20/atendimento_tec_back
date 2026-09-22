import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelsModule } from '@/channels/channels.module';
import { ContactsModule } from '@/contacts/contacts.module';
import { Users } from '@/users/entities/users.entity';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';

import { UsersModule } from '@/users/users.module';

import { ProtocolCounters } from './entities/protocol-counters.entity';
import { SupportChatEvents } from './entities/support-chat-events.entity';
import { SupportChatStatus } from './entities/support-chat-status.entity';
import { SupportChats } from './entities/support-chats.entity';
import { SupportChatMessages } from './messages/entities/support-chat-messages.entity';
import { MessagesModule } from './messages/messages.module';
import { ProtocolCountersRepository } from './protocol-counters.repository';
import { SupportChatsController } from './support-chats.controller';
import { SupportChatEventsRepository } from './support-chat-events.repository';
import { SupportChatsRepository } from './support-chats.repository';
import { SupportChatsService } from './support-chats.service';
import { StorageModule } from '@/storage/storage.module';
import { RedisCacheModule } from '@/redis-cache/redis-cache.module';
import { ServiceAlertsModule } from '@/service-alerts/service-alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportChats,
      SupportChatMessages,
      SupportChatStatus,
      Users,
      ProtocolCounters,
      SupportChatEvents,
    ]),
    UsersModule,
    ServiceAlertsModule,
    forwardRef(() => WhatsappModule),
    forwardRef(() => ContactsModule),
    MessagesModule,
    ChannelsModule,
    StorageModule,
    RedisCacheModule,
  ],
  controllers: [SupportChatsController],
  providers: [
    SupportChatsService,
    SupportChatsRepository,
    SupportChatEventsRepository,
    ProtocolCountersRepository,
  ],
  exports: [SupportChatsService],
})
export class SupportChatsModule {}
