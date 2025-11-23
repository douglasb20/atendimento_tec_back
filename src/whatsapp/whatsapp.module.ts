import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'auth/auth.module';

import { WhatsappSessionProcessor } from './processors/whatsapp-session.processor';
import { WhatsappMessagesProcessor } from './processors/whatsapp-messages.processor';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappService } from './whatsapp.service';
import { SupportChatsModule } from '@/support-chats/support-chats.module';
import { ChannelsModule } from '@/channels/channels.module';

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
    WhatsappSessionProcessor,
    WhatsappMessagesProcessor,
  ],
  exports: [WhatsappService, WhatsappGateway],
})
export class WhatsappModule {}
