import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { SigninDto } from 'users/dto/signin.dto';
import { AuthService } from './auth.service';
import { LogoutMobileDto, RefreshMobileDto } from './dto/refresh-mobile.dto';

/**
 * Sessão do app mobile.
 *
 * Mesma geração, rotação e revogação de tokens do portal (`AuthService`); muda
 * só a entrega. O portal recebe os tokens em cookie httpOnly, que é feito para
 * navegador. O app nativo não tem onde guardar cookie com segurança: recebe os
 * tokens no corpo e os guarda no cofre do aparelho (SecureStore). Por isso as
 * rotas são separadas, e o login do portal continua sem expor token no JSON.
 */
@Controller('auth/mobile')
export class AuthMobileController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('/signin')
  @HttpCode(HttpStatus.OK)
  async signin(@Body() dto: SigninDto, @Req() request: Request) {
    const sessao = await this.authService.signin(dto.email, dto.password, request);

    return {
      access_token: sessao.access_token,
      refresh_token: sessao.refresh_token,
      expires_at: this.expDoAccess(sessao.access_token),
      usuario: sessao.usuario,
    };
  }

  /** O refresh vem só do corpo: o cookie é do portal e não vale aqui. */
  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshMobileDto, @Req() request: Request) {
    const sessao = await this.authService.refresh(dto.refresh_token, request);

    return {
      access_token: sessao.access_token,
      refresh_token: sessao.refresh_token,
      expires_at: this.expDoAccess(sessao.access_token),
    };
  }

  /**
   * Apaga o refresh do banco, e não só do aparelho: um token copiado antes da
   * saída deixa de renovar sessão. Sem token, só confirma - a saída do app não
   * pode travar por falta dele.
   */
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutMobileDto) {
    if (dto?.refresh_token) await this.authService.revogarRefresh(dto.refresh_token);
    return { status: 'ok' };
  }

  /** `exp` do access em segundos, o mesmo `expires_at` que o portal recebe. */
  private expDoAccess(accessToken: string): number {
    return this.jwtService.decode<{ exp: number }>(accessToken).exp;
  }
}
