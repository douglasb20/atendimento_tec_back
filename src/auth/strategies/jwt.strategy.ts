import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthService } from '../auth.service';
import { SigninDto } from 'users/dto/signin.dto';
import { JwtPayload } from '../models/jwt-payload.model';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.ACCESS_JWT_SECRET,
    });
  }

  async validate(jwtPayload: JwtPayload): Promise<SigninDto> {
    if (jwtPayload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.authService.validadeUser(jwtPayload);
    return user;
  }
}
