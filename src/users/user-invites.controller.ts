import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { AceitarConviteDto } from './dto/aceitar-convite.dto';
import { ResultadoValidacao, UserInvitesService } from './user-invites.service';

/**
 * Aceite de convite de cadastro.
 *
 * Os dois endpoints são **públicos**, sem guard nenhum: quem está aceitando
 * um convite ainda não tem sessão. A proteção é o token - 256 bits de
 * aleatoriedade, válido uma vez só e por prazo curto.
 */
@Controller('convites')
export class UserInvitesController {
  constructor(private readonly userInvitesService: UserInvitesService) {}

  /**
   * Checagem prévia, feita pela tela antes de mostrar o formulário.
   *
   * Responde 200 mesmo para token inválido, com o motivo no corpo - o front
   * precisa distinguir "expirou" de "já usei" para explicar o que houve.
   */
  @Get('/:token/valido')
  @HttpCode(HttpStatus.OK)
  async validar(@Param('token') token: string): Promise<ResultadoValidacao> {
    return this.userInvitesService.validar(token);
  }

  @Post('/:token/aceitar')
  @HttpCode(HttpStatus.OK)
  async aceitar(@Param('token') token: string, @Body() dto: AceitarConviteDto): Promise<void> {
    return this.userInvitesService.aceitar(token, dto);
  }
}
