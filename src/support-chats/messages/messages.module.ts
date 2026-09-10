import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StorageService } from '@/storage/storage.service';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';

import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { MessagesController } from './messages.controller';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';
import { MediaRetentionService } from './media-retention.service';
import { RedisCacheModule } from '@/redis-cache/redis-cache.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportChats, SupportChatMessages]),
    forwardRef(() => WhatsappModule),
    RedisCacheModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, StorageService, MediaRetentionService],
  exports: [MessagesService, MediaRetentionService],
})
export class MessagesModule {}
