import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { ChannelsService } from './channels.service';
import { CreateOrChannelDto } from './dto/create-or-channel.dto';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:view')
  @HttpCode(HttpStatus.OK)
  async getActiveChannels() {
    return this.channelsService.getActiveChannels();
  }

  @Get('/:channelId')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:view')
  @HttpCode(HttpStatus.OK)
  async findChannel(@Param('channelId') channelId: number) {
    return this.channelsService.findChannelComSetores(channelId);
  }

  /**
   * Abre a sessão e devolve o QR code para parear.
   *
   * ⚠️ `channel:config`, não `channel:view`: até a migration `1789550000000`
   * esta rota exigia só `view`, e quem podia enxergar a lista de canais
   * conseguia mexer na conexão de todos.
   */
  @Get('/:channelId/start')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:config')
  @HttpCode(HttpStatus.OK)
  async startSession(@Param('channelId') channelId: number) {
    return this.channelsService.startSession(channelId);
  }

  /**
   * Derruba a sessão. **Para o atendimento de todo mundo naquele canal** - é a
   * ação mais destrutiva do módulo, e por isso exige `channel:config`.
   */
  @Get('/:channelId/terminate')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:config')
  @HttpCode(HttpStatus.OK)
  async closeSession(@Param('channelId') channelId: number) {
    return this.channelsService.closeSession(channelId);
  }

  /**
   * Derruba e reconecta a sessão, sem perder o pareamento.
   *
   * `channel:config` como o `start` e o `terminate`: é a mesma natureza das
   * três - mexer na sessão -, e separá-las faria derrubar e subir a conexão
   * depender de duas permissões diferentes.
   */
  @Post('/:channelId/reiniciar')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:config')
  @HttpCode(HttpStatus.OK)
  async restartSession(@Param('channelId') channelId: number) {
    return this.channelsService.restartSession(channelId);
  }

  /**
   * Consulta o estado real da sessão no provider e corrige o nosso registro.
   *
   * `channel:view` e não `:update` de propósito: quem enxerga o canal precisa
   * poder confirmar se ele está de pé, e a rota não muda nada por conta
   * própria - só alinha o banco ao que o provider já diz.
   */
  @Get('/:channelId/sincronizar-status')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:view')
  @HttpCode(HttpStatus.OK)
  async sincronizarStatus(@Param('channelId') channelId: number) {
    return this.channelsService.sincronizarStatus(channelId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:add')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(@Body() createChannelDto: CreateOrChannelDto) {
    return this.channelsService.createChannel(createChannelDto);
  }

  @Patch('/:channelId')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:update')
  @HttpCode(HttpStatus.OK)
  async updateChannel(
    @Param('channelId') channelId: number,
    @Body() createChannelDto: CreateOrChannelDto,
  ) {
    return this.channelsService.updateChannel(channelId, createChannelDto);
  }

  @Delete('/:channelId')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeChannel(@Param('channelId') channelId: number) {
    return this.channelsService.removeChannel(channelId);
  }
}
