import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { ListarMensagensDto } from './dto/listar-mensagens.dto';
import { SendInternalMessageDto } from './dto/send-internal-message.dto';
import { SignInternalMediaDto } from './dto/sign-internal-media.dto';
import { InternalChatsService } from './internal-chats.service';

/**
 * Chat interno: conversa direta entre usuários do portal.
 *
 * ⚠️ **As permissões aqui não decidem de quem é a conversa.**
 * `internal.chat:view` autoriza usar a funcionalidade; quem participa de cada
 * conversa é verificado no service, comparando o usuário logado com as duas
 * pontas. Sem isso, qualquer um leria qualquer conversa trocando o id na URL.
 */
@Controller('internal-chats')
export class InternalChatsController {
  constructor(private readonly internalChatsService: InternalChatsService) {}

  /**
   * Os colegas disponíveis, com quem está online.
   *
   * Rota própria em vez de `GET /users`: aquela exige `user:view`, que é
   * administrativa - o atendente comum não a tem e ficaria sem lista de
   * colegas. Aqui saem só os campos que a lista precisa.
   */
  @Get('/colegas')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('internal.chat:view')
  @HttpCode(HttpStatus.OK)
  async listarColegas(@Req() req: Request) {
    return this.internalChatsService.listarColegas(req.user['id']);
  }

  /** As conversas do usuário logado, com a última mensagem e as não lidas. */
  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('internal.chat:view')
  @HttpCode(HttpStatus.OK)
  async listarConversas(@Req() req: Request) {
    return this.internalChatsService.listarConversas(req.user['id']);
  }

  /** Total de não lidas - alimenta o badge geral. */
  @Get('/nao-lidas')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('internal.chat:view')
  @HttpCode(HttpStatus.OK)
  async contarNaoLidas(@Req() req: Request) {
    return this.internalChatsService.contarNaoLidas(req.user['id']);
  }

  /**
   * URL assinada para subir um arquivo.
   *
   * `POST` mesmo sem criar recurso: o mimetype vai no corpo, e a resposta é uma
   * credencial temporária que não deve ficar no log de acesso.
   */
  @Post('/sign-media')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('internal.chat:send')
  @HttpCode(HttpStatus.OK)
  async assinarMidia(@Body() dto: SignInternalMediaDto) {
    return this.internalChatsService.assinarMidia(dto);
  }

  /**
   * O histórico de uma conversa.
   *
   * ⚠️ Rota com id: o service confere a participação antes de devolver.
   */
  @Get('/:id/messages')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('internal.chat:view')
  @HttpCode(HttpStatus.OK)
  async listarMensagens(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: ListarMensagensDto,
    @Req() req: Request,
  ) {
    return this.internalChatsService.listarMensagens(
      id,
      req.user['id'],
      query.limite,
      query.antes_de,
    );
  }

  /**
   * Marca como lidas as mensagens que o outro mandou.
   *
   * ⚠️ Rota com id: o service confere a participação.
   */
  @Patch('/:id/read')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('internal.chat:view')
  @HttpCode(HttpStatus.OK)
  async marcarLidas(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.internalChatsService.marcarLidas(id, req.user['id']);
  }

  /**
   * Envia uma mensagem a um colega.
   *
   * O parâmetro é o **id do destinatário**, não o da conversa: quem escreve
   * pela primeira vez ainda não tem conversa, e exigir que o front a criasse
   * antes duplicaria a corrida que o banco já resolve.
   */
  @Post('/:userId/messages')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('internal.chat:send')
  @HttpCode(HttpStatus.CREATED)
  async enviar(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SendInternalMessageDto,
    @Req() req: Request,
  ) {
    return this.internalChatsService.enviar(userId, req.user['id'], dto);
  }
}
