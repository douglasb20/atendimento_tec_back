import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    // A validação do payload pode ser feita com um DTO específico
    this.whatsappService.processWebhook(payload);
    return { status: 'received' };
  }

  @Post('send-message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    await this.whatsappService.sendMessage(sendMessageDto.to, sendMessageDto.message);
    return { status: 'message sent' };
  }
}