import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { PasswordResetService, ResultadoValidacao } from './password-reset.service';

/**
 * Recuperação de senha.
 *
 * Os três endpoints são **públicos**, sem guard nenhum: quem esqueceu a senha
 * não tem sessão. A proteção é o token — 256 bits de aleatoriedade, válido uma
 * vez só e por prazo curto.
 */
@Controller('auth')
export class PasswordResetController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('/esqueci-senha')
  @HttpCode(HttpStatus.OK)
  async solicitar(@Body() dto: EsqueciSenhaDto): Promise<void> {
    return this.passwordResetService.solicitar(dto.email);
  }

  /**
   * Checagem prévia, feita pela tela antes de mostrar o formulário.
   *
   * Responde 200 mesmo para token inválido, com o motivo no corpo: o front
   * precisa distinguir "expirou" de "já usei" para explicar o que houve, e um
   * 4xx obrigaria a ler mensagem de erro para descobrir.
   */
  @Get('/redefinir-senha/:token/valido')
  @HttpCode(HttpStatus.OK)
  async validar(@Param('token') token: string): Promise<ResultadoValidacao> {
    return this.passwordResetService.validar(token);
  }

  @Post('/redefinir-senha')
  @HttpCode(HttpStatus.OK)
  async redefinir(@Body() dto: RedefinirSenhaDto): Promise<void> {
    return this.passwordResetService.redefinir(dto.token, dto.password);
  }
}
