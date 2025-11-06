import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportChats } from 'support-chats/entities/support-chats.entity';
import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { MessagesRepository } from './messages.repository';

@Module({
  imports: [TypeOrmModule.forFeature([SupportChats, SupportChatMessages])],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
  exports: [MessagesService],
})
export class MessagesModule {}
