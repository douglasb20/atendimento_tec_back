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

import { SupportChatsService } from './support-chats.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendMediaDto } from './dto/send-media.dto';
import { SignMediaPostDto } from './dto/sign-media-post.dto';

@Controller('support-chats')
export class SupportChatsController {
  constructor(private readonly supportChatsService: SupportChatsService) {}

  @Post('/:id/send-message')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() sendMessageDto: SendMessageDto,
    @Req() req: Request,
  ) {
    await this.supportChatsService.sendMessage(
      id,
      sendMessageDto.chat_id,
      `*${req.user['name']}:*\n${sendMessageDto.message}`,
    );
    return { status: 'message sent' };
  }

  @Post('/sign-media-post')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async signMediaPost(@Body() signMediaPostDto: SignMediaPostDto) {
    return this.supportChatsService.signMediaPost(signMediaPostDto);
  }

  @Post('/:id/send-reply')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async replyMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() replyMessageDto: ReplyMessageDto,
    @Req() req: Request,
  ) {
    await this.supportChatsService.replyMessage(
      id,
      replyMessageDto.chat_id,
      replyMessageDto.message_id,
      `*${req.user['name']}:*\n${replyMessageDto.message}`,
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

  @Post('/:id/send-media')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async sendMedia(@Param('id', ParseIntPipe) id: number, @Body() sendMediaDto: SendMediaDto) {
    return this.supportChatsService.sendMedia(id, sendMediaDto);
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
