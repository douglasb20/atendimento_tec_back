import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'auth/auth.module';

import { ChannelsModule } from '@/channels/channels.module';
import { IntegrationsModule } from '@/integrations/integrations.module';
import { SupportChatsModule } from '@/support-chats/support-chats.module';
import { WhatsappMessagesProcessor } from './processors/whatsapp-messages.processor';
import { WhatsappSessionProcessor } from './processors/whatsapp-session.processor';
import { ProviderFactory } from './providers/provider.factory';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [
    AuthModule,
    IntegrationsModule,
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
    ProviderFactory,
    WhatsappSessionProcessor,
    WhatsappMessagesProcessor,
  ],
  exports: [WhatsappService, WhatsappGateway, ProviderFactory],
})
export class WhatsappModule {}
