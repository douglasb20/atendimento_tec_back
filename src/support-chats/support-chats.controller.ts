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

  @Get('/:id/messages')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async findSupportChatById(@Param('id', ParseIntPipe) id: number) {
    return this.supportChatsService.findSupportChatsById(id);
  }

  @Post('/:id/send-reaction')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async sendReaction(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    { chat_id, message_id, reaction }: { chat_id: string; message_id: string; reaction: string },
  ) {
    return await this.supportChatsService.sendReactionMessage(id, chat_id, message_id, reaction);
  }
}
