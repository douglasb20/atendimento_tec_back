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

import { Permissions } from '@/permissions/permissions.decorator';
import { PermissionGuard } from '@/permissions/permissions.guard';
import { AlternarAtivoDto } from './dto/alternar-ativo.dto';
import { CreateServiceAlertDto } from './dto/create-service-alert.dto';
import { UpdateServiceAlertDto } from './dto/update-service-alert.dto';
import { ServiceAlertsService } from './service-alerts.service';

@Controller('service-alerts')
export class ServiceAlertsController {
  constructor(private readonly serviceAlertsService: ServiceAlertsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('service.alert:view')
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.serviceAlertsService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('service.alert:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviceAlertsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('service.alert:add')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateServiceAlertDto) {
    return this.serviceAlertsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('service.alert:update')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceAlertDto) {
    return this.serviceAlertsService.update(id, dto);
  }

  /**
   * Liga/desliga em um clique, da própria listagem.
   *
   * Separado do `PATCH :id` porque é a ação do incidente: o problema passou e
   * alguém desliga o aviso sem abrir formulário nenhum.
   */
  @Patch(':id/ativo')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('service.alert:update')
  @HttpCode(HttpStatus.OK)
  async alternarAtivo(@Param('id', ParseIntPipe) id: number, @Body() dto: AlternarAtivoDto) {
    return this.serviceAlertsService.alternarAtivo(id, dto.ativo);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('service.alert:delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviceAlertsService.remove(id);
  }
}
