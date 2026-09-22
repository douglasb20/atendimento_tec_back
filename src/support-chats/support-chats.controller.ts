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
  Query,
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
import { FinalizarSemAtendimentoDto } from './dto/finalizar-sem-atendimento.dto';
import { TransferirAtendimentoDto } from './dto/transferir-atendimento.dto';

@Controller('support-chats')
export class SupportChatsController {
  constructor(private readonly supportChatsService: SupportChatsService) {}

  @Post('/:id/send-message')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() sendMessageDto: SendMessageDto,
    @Req() req: Request,
  ) {
    return this.supportChatsService.sendMessage(
      id,
      req.user['id'],
      sendMessageDto.chat_id,
      `*${req.user['name']}:*\n${sendMessageDto.message}`,
    );
  }

  @Post('/sign-media-post')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async signMediaPost(@Body() signMediaPostDto: SignMediaPostDto) {
    return this.supportChatsService.signMediaPost(signMediaPostDto);
  }

  @Post('/:id/send-reply')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async replyMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() replyMessageDto: ReplyMessageDto,
    @Req() req: Request,
  ) {
    return this.supportChatsService.replyMessage(
      id,
      req.user['id'],
      replyMessageDto.chat_id,
      replyMessageDto.message_id,
      `*${req.user['name']}:*\n${replyMessageDto.message}`,
    );
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:view')
  @HttpCode(HttpStatus.OK)
  async listAllSupportChats() {
    return this.supportChatsService.listAllSupportChats();
  }

  @Get('/:id/messages')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:view')
  @HttpCode(HttpStatus.OK)
  async findSupportChatById(@Param('id', ParseIntPipe) id: number) {
    return this.supportChatsService.findSupportChatsById(id);
  }

  /**
   * Quantos atendimentos anteriores este contato tem.
   *
   * Mesma permissão de abrir a conversa: quem vê o atendimento atual pode ver
   * os anteriores **do mesmo contato** - é o histórico dele, não de outro.
   */
  @Get('/:id/anteriores')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:view')
  @HttpCode(HttpStatus.OK)
  async contarAnteriores(
    @Param('id', ParseIntPipe) id: number,
    @Query('antes_de') antes_de?: string,
  ) {
    return this.supportChatsService.contarAnteriores(
      id,
      antes_de ? Number(antes_de) : undefined,
    );
  }

  /** O atendimento imediatamente anterior ao informado, com suas mensagens. */
  @Get('/:id/anterior')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:view')
  @HttpCode(HttpStatus.OK)
  async findAnterior(
    @Param('id', ParseIntPipe) id: number,
    @Query('antes_de', ParseIntPipe) antes_de: number,
  ) {
    return this.supportChatsService.findAnterior(id, antes_de);
  }

  @Post('/:id/send-media')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async sendMedia(
    @Param('id', ParseIntPipe) id: number,
    @Body() sendMediaDto: SendMediaDto,
    @Req() req: Request,
  ) {
    // A legenda leva o mesmo prefixo do texto: numa conversa atendida por mais
    // de uma pessoa, é o que identifica quem falou no WhatsApp do cliente -
    // lá só chega texto, não há como marcar o autor de outro jeito.
    return this.supportChatsService.sendMedia(id, req.user['id'], {
      ...sendMediaDto,
      caption: sendMediaDto.caption
        ? `*${req.user['name']}:*\n${sendMediaDto.caption}`
        : sendMediaDto.caption,
    });
  }

  @Post('/:id/delete-message')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('message:delete')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() { message_id }: { message_id: string },
    @Req() req: Request,
  ) {
    if (!message_id) {
      throw new BadRequestException('O campo message_id é obrigatório');
    }
    return this.supportChatsService.deleteMessage(id, req.user['id'], message_id);
  }

  /**
   * Oculta mensagens do portal, sem revogar no WhatsApp.
   *
   * Complementa o `delete-message`: aquele alcança o contato e só vale para
   * mensagem própria dentro de 60h; este some apenas do nosso lado.
   */
  @Post('/:id/ocultar-mensagens')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('message:delete')
  @HttpCode(HttpStatus.OK)
  async ocultarMensagens(
    @Param('id', ParseIntPipe) id: number,
    @Body() { message_ids }: { message_ids: string[] },
    @Req() req: Request,
  ) {
    if (!Array.isArray(message_ids) || message_ids.length === 0) {
      throw new BadRequestException('O campo message_ids é obrigatório');
    }
    return this.supportChatsService.ocultarMensagens(id, req.user['id'], message_ids);
  }

  @Post('/:id/marcar-lida')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:view')
  @HttpCode(HttpStatus.OK)
  async marcarComoLida(@Param('id', ParseIntPipe) id: number) {
    return this.supportChatsService.marcarComoLida(id);
  }

  /**
   * O inverso do `marcar-lida`: devolve a conversa à lista como não lida.
   *
   * `support.chat:view` como a irmã: é sinalização de leitura, não alteração
   * do atendimento.
   */
  @Post('/:id/marcar-nao-lida')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:view')
  @HttpCode(HttpStatus.OK)
  async marcarComoNaoLida(@Param('id', ParseIntPipe) id: number) {
    return this.supportChatsService.marcarComoNaoLida(id);
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

  /**
   * Encerra sem que tenha havido atendimento - spam, engano, contato que não
   * será atendido.
   *
   * Rota própria e não um sinalizador no `finalizar`: as regras são opostas.
   * Aquele exige dono, cliente associado e estado `EM_ANDAMENTO`; este recusa
   * justamente o `EM_ANDAMENTO` e dispensa as outras duas.
   */
  @Post('/:id/finalizar-sem-atendimento')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async finalizarSemAtendimento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinalizarSemAtendimentoDto,
    @Req() req: Request,
  ) {
    return this.supportChatsService.finalizarSemAtendimento(id, req.user['id'], dto);
  }

  /**
   * Permissão própria, e não o `support.chat:update` das demais ações:
   * transferir é a única que tira a conversa das mãos de alguém.
   */
  @Post('/:id/transferir')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:transfer')
  @HttpCode(HttpStatus.OK)
  async transferirAtendimento(
    @Param('id', ParseIntPipe) id: number,
    @Body() transferirAtendimentoDto: TransferirAtendimentoDto,
    @Req() req: Request,
  ) {
    // O ator vem do token, nunca do corpo: senão daria para transferir em nome
    // de outro atendente.
    return this.supportChatsService.transferirAtendimento(
      id,
      req.user['id'],
      transferirAtendimentoDto,
    );
  }

  @Post('/:id/edit-message')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('message:update')
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
      req.user['id'],
      message_id,
      `*${req.user['name']}:*\n${message.trim()}`,
    );
  }

  @Post('/:id/send-reaction')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  async sendReaction(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    { chat_id, message_id, reaction }: { chat_id: string; message_id: string; reaction: string },
    @Req() req: Request,
  ) {
    return await this.supportChatsService.sendReactionMessage(
      id,
      req.user['id'],
      chat_id,
      message_id,
      reaction,
    );
  }
}
