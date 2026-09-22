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
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { TestarConexaoDto } from './dto/testar-conexao.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /** Providers disponíveis - alimenta a seleção do formulário. */
  @Get('/providers')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:view')
  @HttpCode(HttpStatus.OK)
  async listarProviders() {
    return this.integrationsService.listarProviders();
  }

  /**
   * Credenciais em claro, para o formulário exibi-las quando solicitado.
   *
   * `integration:update` e não `view`: quem pode trocar a chave já dispõe do
   * poder que lê-la concede. É o único endpoint que as devolve.
   */
  @Get('/:id/credenciais')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:update')
  @HttpCode(HttpStatus.OK)
  async revelarCredenciais(@Param('id', ParseIntPipe) id: number) {
    return this.integrationsService.revelarCredenciais(id);
  }

  /**
   * Testa se a integração alcança o provider e se a credencial é aceita.
   *
   * `POST` mesmo sendo consulta: recebe credencial no corpo, que não pode ir
   * pela URL (fica no log de acesso e no histórico do navegador).
   */
  @Post('/testar-conexao')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:view')
  @HttpCode(HttpStatus.OK)
  async testarConexao(@Body() dto: TestarConexaoDto) {
    return this.integrationsService.testarConexao(dto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:view')
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.integrationsService.findAll();
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.integrationsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:add')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createIntegrationDto: CreateIntegrationDto) {
    return this.integrationsService.create(createIntegrationDto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:update')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateIntegrationDto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.update(id, updateIntegrationDto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('integration:delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.integrationsService.remove(id);
  }
}
