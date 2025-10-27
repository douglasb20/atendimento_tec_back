import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappService } from './whatsapp.service';
import { AuthModule } from 'auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappGateway],
  exports: [WhatsappService, WhatsappGateway],
})
export class WhatsappModule {}
