import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappMessage } from './entities/whatsapp-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappMessage])],
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappGateway],
})
export class WhatsappModule {}