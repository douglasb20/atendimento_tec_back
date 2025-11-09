import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';
import { StorageService } from '@/storage/storage.service';

import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { MessagesController } from './messages.controller';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportChats, SupportChatMessages]), WhatsappModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, StorageService],
  exports: [MessagesService],
})
export class MessagesModule { }
