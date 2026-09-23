import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { SemPermissao } from 'permissions/sem-permissao.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { AtualizarPreferenciasDto } from './dto/atualizar-preferencias.dto';
import { UserConfigService } from './user-config.service';

/**
 * As preferências do próprio usuário.
 *
 * `@SemPermissao()` nas duas rotas: mexer na própria preferência é piso de
 * qualquer papel - inclusive do superusuário, que usa o portal como todo mundo.
 *
 * ⚠️ **O alvo vem sempre do token**, nunca de parâmetro. Sem isso, `user_id` na
 * URL deixaria qualquer um trocar o tema (e as notificações) dos outros.
 */
@Controller('user-config')
export class UserConfigController {
  constructor(private readonly userConfigService: UserConfigService) {}

  /** O catálogo com os valores em vigor, para o modal de perfil montar. */
  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async paraTela(@Req() req: Request) {
    return this.userConfigService.paraTela(
      req.user['id'],
      Number(req.user['is_superuser']) === 1,
    );
  }

  @Patch()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.OK)
  async atualizar(@Body() dto: AtualizarPreferenciasDto, @Req() req: Request) {
    return this.userConfigService.atualizar(req.user['id'], dto.preferencias);
  }
}
