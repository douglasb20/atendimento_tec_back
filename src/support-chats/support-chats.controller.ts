import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { SendMessageDto } from './dto/send-message.dto';
import { SupportChatsService } from './support-chats.service';

@Controller('support-chats')
export class SupportChatsController {
  constructor(private readonly supportChatsService: SupportChatsService) {}

  @Post('send-message')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() sendMessageDto: SendMessageDto, @Req() req: Request) {
    await this.supportChatsService.sendMessage(
      sendMessageDto.to,
      `*${req.user['name']}:*\n${sendMessageDto.message}`,
    );
    return { status: 'message sent' };
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async listAllSupportChats() {
    return this.supportChatsService.listAllSupportChats();
  }

  @Get('messages/:id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async findSupportChatById(@Param('id', ParseIntPipe) id: number) {
    return this.supportChatsService.findSupportChatsById(id);
  }
}
