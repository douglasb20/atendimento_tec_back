import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { SupportChatsService } from './support-chats.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('support-chats')
export class SupportChatsController {
  constructor(private readonly supportChatsService: SupportChatsService) {}

  @Post('send-message')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() sendMessageDto: SendMessageDto, @Req() req: Request) {
    console.log('User:', req.user); // Access authenticated user information
    await this.supportChatsService.sendMessage(
      sendMessageDto.to,
      `*${req.user['name']}:*\n${sendMessageDto.message}`,
    );
    return { status: 'message sent' };
  }

  @Get('test')
  async test() {
    return this.supportChatsService.test();
  }
}
