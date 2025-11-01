import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportChats } from 'support-chats/entities/support-chats.entity';
import { SupportChatMessages } from 'support-chats/entities/support-chat-messages.entity';
import { ChannelStatus } from './entities/channel-status.entity';
import { Channels } from './entities/channels.entity';

import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ChannelsRepository } from './channels.repository';
import { ChannelsListener } from './channels.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportChats, SupportChatMessages, ChannelStatus, Channels]),
    WhatsappModule,
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsRepository, ChannelsListener],
})
export class ChannelsModule {}
