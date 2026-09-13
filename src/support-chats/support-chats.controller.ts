import {
  BadRequestException,
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
import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { Request } from 'express';

import { SupportChatsService } from './support-chats.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendMediaDto } from './dto/send-media.dto';
import { SignMediaPostDto } from './dto/sign-media-post.dto';
import { FinalizarAtendimentoDto } from './dto/finalizar-atendimento.dto';

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
    return this.supportChatsService.sendMessage(
      id,
      sendMessageDto.chat_id,
      `*${req.user['name']}:*\n${sendMessageDto.message}`,
    );
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
    return this.supportChatsService.replyMessage(
      id,
      replyMessageDto.chat_id,
      replyMessageDto.message_id,
      `*${req.user['name']}:*\n${replyMessageDto.message}`,
    );
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
  async sendMedia(
    @Param('id', ParseIntPipe) id: number,
    @Body() sendMediaDto: SendMediaDto,
    @Req() req: Request,
  ) {
    // A legenda leva o mesmo prefixo do texto: numa conversa atendida por mais
    // de uma pessoa, é o que identifica quem falou no WhatsApp do cliente -
    // lá só chega texto, não há como marcar o autor de outro jeito.
    return this.supportChatsService.sendMedia(id, {
      ...sendMediaDto,
      caption: sendMediaDto.caption
        ? `*${req.user['name']}:*\n${sendMediaDto.caption}`
        : sendMediaDto.caption,
    });
  }

  @Post('/:id/delete-message')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() { message_id }: { message_id: string },
  ) {
    if (!message_id) {
      throw new BadRequestException('O campo message_id é obrigatório');
    }
    return this.supportChatsService.deleteMessage(id, message_id);
  }

  @Post('/:id/marcar-lida')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async marcarComoLida(@Param('id', ParseIntPipe) id: number) {
    return this.supportChatsService.marcarComoLida(id);
  }

  @Post('/:id/iniciar')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async iniciarAtendimento(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.supportChatsService.iniciarAtendimento(id, req.user['id']);
  }

  @Post('/:id/finalizar')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async finalizarAtendimento(
    @Param('id', ParseIntPipe) id: number,
    @Body() finalizarAtendimentoDto: FinalizarAtendimentoDto,
    @Req() req: Request,
  ) {
    return this.supportChatsService.finalizarAtendimento(
      id,
      req.user['id'],
      finalizarAtendimentoDto,
    );
  }

  @Post('/:id/edit-message')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async editMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() { message_id, message }: { message_id: string; message: string },
    @Req() req: Request,
  ) {
    if (!message_id || !message?.trim()) {
      throw new BadRequestException('Informe a mensagem e o texto da edição');
    }

    // O prefixo acompanha o texto editado, como no envio: sem ele a mensagem
    // perderia a identificação do atendente ao ser alterada.
    return this.supportChatsService.editMessage(
      id,
      message_id,
      `*${req.user['name']}:*\n${message.trim()}`,
    );
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
