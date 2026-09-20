import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { ApenasSuperusuario } from 'permissions/apenas-superusuario.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { ConfigMailerService, ResultadoTeste } from 'core/mailer/configmailer.service';
import { Users } from '@/users/entities/users.entity';
import { AtualizarAjustesDto } from './dto/atualizar-ajustes.dto';
import { TestarEmailDto } from './dto/testar-email.dto';
import { AjusteParaTela, SystemSettingsService } from './system-settings.service';

/**
 * Ajustes do sistema — restrito ao usuário master.
 *
 * `@ApenasSuperusuario` e não `@Permissions`: estes valores mudam o
 * comportamento para todos os usuários, e poder concedê-los por grupo seria
 * conceder demais.
 */
@Controller('system-settings')
export class SystemSettingsController {
  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly mailerService: ConfigMailerService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @ApenasSuperusuario()
  @HttpCode(HttpStatus.OK)
  async listar(): Promise<AjusteParaTela[]> {
    return this.settingsService.paraTela();
  }

  @Patch()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @ApenasSuperusuario()
  @HttpCode(HttpStatus.OK)
  async atualizar(@Body() dto: AtualizarAjustesDto, @Req() req: Request): Promise<void> {
    const user = req.user as Users;

    await this.settingsService.atualizar(dto.ajustes, user?.id ?? null);

    // O transporte em uso foi montado com a configuração anterior; descartá-lo
    // faz a próxima mensagem ser enviada já pelo servidor novo.
    this.mailerService.invalidaTransporte();
  }

  @Post('/testar-email')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @ApenasSuperusuario()
  @HttpCode(HttpStatus.OK)
  async testarEmail(@Body() dto: TestarEmailDto): Promise<ResultadoTeste> {
    const { destinatario, ...credenciais } = dto;

    return this.mailerService.testarConexao(destinatario, credenciais);
  }
}
