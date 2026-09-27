import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'auth/auth.module';

import { ChannelsModule } from '@/channels/channels.module';
import { SupportChatsModule } from '@/support-chats/support-chats.module';
import { WhatsappMessagesProcessor } from './processors/whatsapp-messages.processor';
import { WhatsappSessionProcessor } from './processors/whatsapp-session.processor';
import { EvolutionProvider } from './providers/evolution/evolution.provider';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue(
      {
        name: 'whatsapp-messages-queue',
      },
      {
        name: 'whatsapp-session-queue',
      },
    ),
    forwardRef(() => SupportChatsModule),
    forwardRef(() => ChannelsModule),
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    WhatsappGateway,
    EvolutionProvider,
    WhatsappSessionProcessor,
    WhatsappMessagesProcessor,
  ],
  exports: [WhatsappService, WhatsappGateway, EvolutionProvider],
})
export class WhatsappModule {}
