import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any, @Req() req: Request) {
    // A validação do payload pode ser feita com um DTO específico
    const globalApiKey = process.env.WHATSAPP_API_KEY;
    if (globalApiKey) {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== globalApiKey) {
        return { error: 'Invalid API key' };
      }
    }
    try {
      await this.whatsappService.processWebhook(payload);
      // console.log(payload);
      return { status: 'received' };
    } catch (error) {
      throw error;
    }
  }
}
