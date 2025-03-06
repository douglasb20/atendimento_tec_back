import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { format } from 'date-fns';
import { Request } from 'express';

import { UsersEntity } from 'users/entities/users.entity';
import { JwtPayload } from './models/jwt-payload.model';
import { ConfigMailerService } from 'mailer/configmailer.service';
import { UpdateUserDto } from 'users/dto/update-user.dto';
import { UserRepository } from 'users/users.repository';

type TokenResponse = {
  access_token: string;
  refresh_token: string;
}
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UserRepository,
    private readonly mailerService: ConfigMailerService,
    private readonly jwtService: JwtService
  ) {
  }

  public async createToken(user: UsersEntity, request: Request): Promise<TokenResponse> {
    const issuer = `${request.protocol}://${request.get('host')}`
    const payload = {
      iss: issuer,
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      lastlogin_at: user.lastlogin_at,
    }
    const access_token = this.jwtService.sign(
      { ...payload, type: 'access' },
    );

    const refresh_token = this.jwtService.sign(
      {
        iss: payload.iss,
        sub: payload.sub,
        id: payload.id,
        type: 'refresh'
      },
      {
        secret: process.env.REFRESH_JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRATION,
      },
    );
    return { access_token, refresh_token }
  }

  public async validadeUser(jwtPayload: JwtPayload): Promise<UsersEntity> {
    const user = await this.usersRepository.findById(jwtPayload.sub);
    if (!user) {
      this.logger.error('Erro de validação: Usuário não encontrado');
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return user;
  }

  public async signin(email: string, password: string, request: Request) {
    const user = await this.findByEmail(email);
    await this.checkPassword(password, user);

    const token = await this.createToken(user, request);

    const updateLastLogin: Partial<UpdateUserDto> = {
      lastlogin_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      refresh_token: token.refresh_token
    };

    this.usersRepository.update(user.id, updateLastLogin);

    return {
      ...token,
      expiresIn: Number(process.env.JWT_EXPIRATION) / 1000,
    };
  }

  private async findByEmail(email: string): Promise<UsersEntity> {
    const user = await this.usersRepository.findOne({
      where: { email, status: 1 },
      select: ['id', 'name', 'email', 'password', 'lastlogin_at'],
    });

    if (!user) {
      this.logger.error('Erro autenticação: Usuário e/ou senha incorreto!');
      throw new BadRequestException('Usuário e/ou senha incorreto!');
    }

    return user;
  }

  private async checkPassword(password: string, user: UsersEntity): Promise<boolean> {
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      this.logger.error('Erro autenticação: Usuário e/ou senha incorreto!');
      throw new BadRequestException('Usuário e/ou senha incorreto!');
    }

    return match;
  }

  async forgottenPassword(email: string): Promise<void> {
    const user = await this.findByEmail(email);
    await this.mailerService.SendForgottenPassword(user.name, user.id, user.email);
    const altRequestPassword = {
      ...user,
      is_requestpassword: 1,
    };

    await this.usersRepository.update(user.id, altRequestPassword);
  }

  async refresh(refreshToken: string, request: Request) {
    try {

      const payload: JwtPayload = this.jwtService.verify(refreshToken, {
        secret: process.env.REFRESH_JWT_SECRET
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }
      const user = await this.validadeUser(payload);
      
      if (!user || user.refresh_token !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const token = await this.createToken(user, request);

      await this.usersRepository.updateRefreshTokenUser(user.id, token.refresh_token);
      return { ...token }

    } catch (err) {
      throw new UnauthorizedException(err.message)
    }
  }
}
