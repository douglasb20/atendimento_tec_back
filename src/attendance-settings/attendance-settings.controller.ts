import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { SemPermissao } from 'permissions/sem-permissao.decorator';
import { Users } from '@/users/entities/users.entity';
import {
  AjusteAtendimentoParaTela,
  AttendanceSettingsService,
} from './attendance-settings.service';
import { AtualizarAjustesAtendimentoDto } from './dto/atualizar-ajustes-atendimento.dto';

/**
 * Ajustes de atendimento - tela de negócio, separada de `system-settings`
 * (que é operação da API, restrita ao usuário master). Delegável: qualquer
 * usuário com `attendance_settings:manage` acessa a tela de gestão.
 *
 * A permissão governa só quem pode **ver a tela e editar** - os valores em si
 * são característica de funcionamento do atendimento (assinatura, ordenação
 * da fila, etc.), que todo atendente precisa que sejam aplicados, não um
 * segredo administrativo. Por isso `/vigentes` é `@SemPermissao`, distinto do
 * `GET` de gestão (que traz rótulo/descrição, só para montar a tela).
 */
@Controller('attendance-settings')
export class AttendanceSettingsController {
  constructor(private readonly settingsService: AttendanceSettingsService) {}

  @Get('/vigentes')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async vigentes(): Promise<Record<string, boolean>> {
    return this.settingsService.vigentes();
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('attendance_settings:manage')
  @HttpCode(HttpStatus.OK)
  async listar(): Promise<AjusteAtendimentoParaTela[]> {
    return this.settingsService.paraTela();
  }

  @Patch()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('attendance_settings:manage')
  @HttpCode(HttpStatus.OK)
  async atualizar(
    @Body() dto: AtualizarAjustesAtendimentoDto,
    @Req() req: Request,
  ): Promise<void> {
    const user = req.user as Users;

    await this.settingsService.atualizar(dto.ajustes, user?.id ?? null);
  }
}
