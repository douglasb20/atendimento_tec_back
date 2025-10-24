import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AtendimentoChats } from 'atendimento-chat/entities/atendimento-chats.entity';
import { AtendimentoChatMessages } from 'atendimento-chat/entities/atendimento-chat-messages.entity';
import { ChannelStatus } from './entities/channel-status.entity';
import { Channels } from './entities/channels.entity';

import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { ChannelsRepository } from './channels.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AtendimentoChats, AtendimentoChatMessages, ChannelStatus, Channels])],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelsRepository],
})
export class ChannelsModule { }
