import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AtendimentoChats } from 'atendimento-chat/entities/atendimento-chats.entity';
import { AtendimentoChatMessages } from 'atendimento-chat/entities/atendimento-chat-messages.entity';
import { ChannelStatus } from './entities/channel-status.entity';
import { Channels } from './entities/channels.entity';

import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ChannelsRepository } from './channels.repository';
import { ChannelsListener } from './channels.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([AtendimentoChats, AtendimentoChatMessages, ChannelStatus, Channels]),
    WhatsappModule,
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsRepository, ChannelsListener],
})
export class ChannelsModule {}
