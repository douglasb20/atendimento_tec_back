import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { AssinarAnexoDto } from './dto/assinar-anexo.dto';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';
import { QuickRepliesService } from './quick-replies.service';

@Controller('quick-replies')
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) {}

  /**
   * ⚠️ `support.chat:view` também: quem atende precisa listar as respostas para
   * usá-las na conversa, e exigir a permissão do cadastro faria o atendente
   * comum ficar sem os atalhos. O guard é OR entre as permissões.
   */
  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('quick.reply:view', 'support.chat:view')
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.quickRepliesService.findAll();
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('quick.reply:view', 'support.chat:view')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quickRepliesService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('quick.reply:add')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createQuickReplyDto: CreateQuickReplyDto) {
    return this.quickRepliesService.create(createQuickReplyDto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('quick.reply:update')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateQuickReplyDto: UpdateQuickReplyDto,
  ) {
    return this.quickRepliesService.update(id, updateQuickReplyDto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('quick.reply:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.quickRepliesService.remove(id);
  }

  /** Assinatura para subir o anexo. O prefixo é fixo no servidor. */
  @Post('/assinar-anexo')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('quick.reply:add', 'quick.reply:update')
  @HttpCode(HttpStatus.OK)
  assinarAnexo(@Body() assinarAnexoDto: AssinarAnexoDto) {
    return this.quickRepliesService.assinarAnexo(assinarAnexoDto);
  }

  /**
   * Prepara o anexo para ser enviado numa conversa.
   *
   * Devolve a key de uma **cópia**, que o front usa no `SendMedia` normal - o
   * arquivo do cadastro não pode ser referenciado pela mensagem, senão o cron
   * de retenção o apagaria meses depois.
   *
   * `support.chat:update` e não `quick.reply:*`: quem envia é o atendente, e a
   * ação é responder ao cliente.
   */
  @Post('/:id/preparar-anexo')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('support.chat:update')
  @HttpCode(HttpStatus.OK)
  prepararAnexo(@Param('id', ParseIntPipe) id: number) {
    return this.quickRepliesService.copiaAnexoParaEnvio(id);
  }
}
