import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any) {
    // A validação do payload pode ser feita com um DTO específico
    this.whatsappService.processWebhook(payload);
    console.log('Webhook received:', payload);
    return { status: 'received' };
  }


}
