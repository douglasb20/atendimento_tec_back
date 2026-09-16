import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';

import {
  COOKIE_REFRESH,
  gravaCookiesDeSessao,
  limpaCookiesDeSessao,
} from '@/core/cookies-de-sessao';
import { SigninDto } from 'users/dto/signin.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Autentica e grava a sessão em cookies **httpOnly**.
   *
   * Os tokens não voltam mais no corpo: o objetivo de gravá-los como httpOnly é
   * justamente que nenhum JavaScript os alcance, e devolvê-los no JSON anularia
   * isso — o front poderia guardá-los onde quisesse. Quem os envia a partir daí
   * é o navegador, em toda requisição.
   */
  @Post('/signin')
  @HttpCode(HttpStatus.OK)
  async signin(
    @Body() userDto: SigninDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessao = await this.authService.signin(userDto.email, userDto.password, request);
    this.aplicaCookies(response, sessao);

    // O `expires_at` também vai no corpo para o cliente decidir quando renovar
    // sem precisar ler cookie — é só um timestamp.
    return { expires_at: this.expDoAccess(sessao.access_token) };
  }

  @Post('/forgotten_password/:email')
  @HttpCode(HttpStatus.OK)
  async forgottenPassword(@Param('email') email: string) {
    return this.authService.forgottenPassword(email);
  }

  /**
   * Renova a sessão.
   *
   * O refresh vem do cookie httpOnly; o corpo é aceito apenas como fallback,
   * para não quebrar clientes que ainda o enviem durante a transição.
   */
  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[COOKIE_REFRESH] ?? body?.refreshToken;

    const sessao = await this.authService.refresh(refreshToken, request);
    this.aplicaCookies(response, sessao);

    return { expires_at: this.expDoAccess(sessao.access_token) };
  }

  /** Encerra a sessão: só o servidor consegue apagar um cookie httpOnly. */
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) response: Response) {
    limpaCookiesDeSessao(response);
    return { status: 'ok' };
  }

  private aplicaCookies(
    response: Response,
    sessao: { access_token: string; refresh_token: string; expiresAt?: number; refresh_expires?: number },
  ) {
    gravaCookiesDeSessao(response, {
      access_token: sessao.access_token,
      refresh_token: sessao.refresh_token,
      access_exp: this.expDoAccess(sessao.access_token),
      refresh_exp: sessao.expiresAt ?? sessao.refresh_expires,
    });
  }

  private expDoAccess(accessToken: string): number {
    return this.jwtService.decode<{ exp: number }>(accessToken).exp;
  }
}
