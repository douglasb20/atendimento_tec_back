import { Controller, Get, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { PermissionGuard } from 'permissions/permissions.guard';
import { SemPermissao } from 'permissions/sem-permissao.decorator';
import { DashboardService } from './dashboard.service';

/**
 * Os números da home.
 *
 * `@SemPermissao()`: a home é a primeira tela de quem entra, e todo papel a vê.
 * São contagens agregadas do sistema - nenhum dado de contato ou conversa em
 * si -, então não há o que restringir por papel aqui.
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('resumo')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async resumo() {
    return this.dashboardService.resumo();
  }

  /** Finalizados por dia, para o gráfico dos últimos 7 dias. */
  @Get('serie-finalizados')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async serieFinalizados() {
    return this.dashboardService.serieFinalizados();
  }

  /** Distribuição por hora do dia, para o gráfico de movimento. */
  @Get('movimento-por-hora')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async movimentoPorHora() {
    return this.dashboardService.movimentoPorHora();
  }
}
