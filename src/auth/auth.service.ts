import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { format } from 'date-fns';
import { Request } from 'express';

import { runInTransaction } from '@/Utils';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtPayload } from '@types';
import { ConfigMailerService } from 'core/mailer/configmailer.service';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { UpdateUserDto } from 'users/dto/update-user.dto';
import { UserRefreshTokens } from 'users/entities/user-refresh-tokens.entity';
import { Users } from 'users/entities/users.entity';
import { UserRepository } from 'users/users.repository';

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  refresh_expires: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly mailerService: ConfigMailerService,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  public async createToken(user: Users, request: Request): Promise<TokenResponse> {
    const issuer = `${request.protocol}://${request.get('host')}`;
    const payload = {
      iss: issuer,
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      lastlogin_at: user.lastlogin_at,
    };
    const access_token = this.jwtService.sign({ ...payload, type: 'access' });

    const refresh_token = this.jwtService.sign(
      {
        iss: payload.iss,
        sub: payload.sub,
        id: payload.id,
        type: 'refresh',
      },
      {
        secret: process.env.REFRESH_JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRATION,
      },
    );
    const refreshDecoded = this.jwtService.decode<{ exp: number }>(refresh_token);

    return { access_token, refresh_token, refresh_expires: refreshDecoded.exp };
  }

  public async signin(email: string, password: string, request: Request) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const user = await this.findByEmail(email);
        await this.checkPassword(password, user);

        const token = await this.createToken(user, request);

        const updateLastLogin: Partial<UpdateUserDto> = {
          lastlogin_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        };

        await manager.update(Users, user.id, updateLastLogin);
        await this.saveRefreshToken(user, token.refresh_token, token.refresh_expires, manager);

        return {
          access_token: token.access_token,
          refresh_token: token.refresh_token,
          expiresAt: token.refresh_expires,
        };
      } catch (err) {
        throw new BadRequestException(err);
      }
    });
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
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const payload: JwtPayload = this.jwtService.verify(refreshToken, {
          secret: process.env.REFRESH_JWT_SECRET,
        });

        if (payload.type !== 'refresh') {
          this.logger.error('Erro de validação: Tipo de token inválido');
          throw new UnauthorizedException('Tipo de token inválido');
        }
        const user = await this.validateUser(payload);
        const userRefresh = await this.validateRefresh(refreshToken);

        if (!user || !userRefresh) {
          this.logger.error('Erro de validação: Refresh token inválido');
          throw new UnauthorizedException('Refresh token inválido');
        }

        const token = await this.createToken(user, request);

        await this.saveRefreshToken(
          user,
          token.refresh_token,
          token.refresh_expires,
          manager,
          userRefresh,
        );
        return { ...token };
      } catch (err) {
        this.logger.error(`Erro de validação: ${err.message}`);
        throw new UnauthorizedException(err.message);
      }
    });
  }

  // ==========================================================

  async saveRefreshToken(
    user: Users,
    refreshToken: string,
    expires: number,
    manager: EntityManager,
    userRefresh: UserRefreshTokens = null,
  ) {
    const newUserRefresh = manager.create(UserRefreshTokens, {
      ...userRefresh,
      user_id: user.id,
      refresh_token: refreshToken,
      expires_at: new Date(expires * 1000),

      users: user,
    });
    await manager.save(UserRefreshTokens, newUserRefresh);
  }

  public async validateRefresh(refreshToken: string): Promise<UserRefreshTokens> {
    return runInTransaction(this.dataSource, async (manager) => {
      const userRefresh = await manager.findOneBy(UserRefreshTokens, {
        refresh_token: refreshToken,
      });
      if (!userRefresh) {
        this.logger.error('Erro de validação: Refresh token não encontrado');
        throw new UnauthorizedException('Refresh token não encontrado');
      }
      return userRefresh;
    });
  }

  public async validateUser(jwtPayload: JwtPayload): Promise<Users> {
    const user = await this.usersRepository.findById(jwtPayload.sub);
    if (!user) {
      this.logger.error('Erro de validação: Usuário não encontrado');
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return user;
  }

  private async checkPassword(password: string, user: Users): Promise<boolean> {
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      this.logger.error('Erro autenticação: Usuário e/ou senha incorreto!');
      throw new BadRequestException('Usuário e/ou senha incorreto!');
    }

    return match;
  }

  private async findByEmail(email: string): Promise<Users> {
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

  @Cron(CronExpression.EVERY_MINUTE)
  async destroyExpiredRefresh() {
    return runInTransaction(this.dataSource, async (manager) => {
      await manager.delete(UserRefreshTokens, { expires_at: LessThan(new Date()) });
    });
  }
}
