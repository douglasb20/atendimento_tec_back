import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { COOKIE_ACCESS } from '@/core/cookies-de-sessao';
import { AuthService } from '../auth.service';
import { SigninDto } from 'users/dto/signin.dto';
import { JwtPayload } from '@types';

/** Lê o access token do cookie httpOnly — o caminho normal desde a migração. */
const doCookie = (req: Request): string | null => req?.cookies?.[COOKIE_ACCESS] ?? null;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      // O cookie vem primeiro; o header Bearer continua aceito para os clientes
      // que ainda o enviam (o REST client dos arquivos `.http`, integrações) e
      // para não quebrar sessões abertas durante a transição.
      jwtFromRequest: ExtractJwt.fromExtractors([
        doCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.ACCESS_JWT_SECRET,
    });
  }

  async validate(jwtPayload: JwtPayload): Promise<SigninDto> {
    if (jwtPayload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.authService.validateUser(jwtPayload);
    return user;
  }
}
