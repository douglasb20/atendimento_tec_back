import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { SemPermissao } from 'permissions/sem-permissao.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { DevicesService } from './devices.service';
import { RegistrarDispositivoDto, RemoverDispositivoDto } from './dto/registrar-dispositivo.dto';

/** Registro dos celulares do app para push. */
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /** O celular do usuário logado (o dono vem do token, nunca do corpo). */
  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @SemPermissao()
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrar(@Body() dto: RegistrarDispositivoDto, @Req() req: Request) {
    await this.devicesService.registrar(req.user['id'], dto.token, dto.nome);
  }

  /**
   * Remove o celular. **Pública:** o app chama também quando a sessão já caiu
   * (refresh vencido), e sem isso o aparelho seguiria recebendo os avisos de
   * quem saiu. O token do Firebase é o próprio segredo: só o aparelho o tem.
   */
  @Post('remover')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Body() dto: RemoverDispositivoDto) {
    await this.devicesService.removerPorToken(dto.token);
  }
}
