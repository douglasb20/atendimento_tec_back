import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportChats } from 'support-chats/entities/support-chats.entity';
import { SupportChatMessages } from 'support-chats/messages/entities/support-chat-messages.entity';
import { ChannelStatus } from './entities/channel-status.entity';
import { Channels } from './entities/channels.entity';

import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { ChannelsController } from './channels.controller';
import { ChannelsListener } from './channels.listener';
import { ChannelsRepository } from './channels.repository';
import { ChannelsService } from './channels.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportChats, SupportChatMessages, ChannelStatus, Channels]),
    forwardRef(() => WhatsappModule),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsRepository, ChannelsListener],
  exports: [ChannelsService, ChannelsRepository],
})
export class ChannelsModule {}
