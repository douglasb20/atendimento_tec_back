import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AtendimentoChatService } from './atendimento-chat.service';
import { AtendimentoChatController } from './atendimento-chat.controller';
import { AtendimentoChatsRepository } from './atendimento-chat.repository';
import { AtendimentoChats } from './entities/atendimento-chats.entity';
import { AtendimentoChatStatus } from './entities/atendimento-chat-status.entity';
import { Channels } from 'channels/entities/channels.entity';
import { AtendimentoChatMessages } from './entities/atendimento-chat-messages.entity';
import { Users } from 'users/entities/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AtendimentoChats, AtendimentoChatMessages, AtendimentoChatStatus, Channels, Users])],
  controllers: [AtendimentoChatController],
  providers: [AtendimentoChatService, AtendimentoChatsRepository],
})
export class AtendimentoChatModule { }
