import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Users } from 'users/entities/users.entity';
import { SigninDto } from 'users/dto/signin.dto';
import { JwtPayload } from './models/jwt-payload.model';
import { ConfigMailerService } from 'mailer/configmailer.service';
import { UpdateUserDto } from 'users/dto/update-user.dto';
import { format } from 'date-fns';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private readonly mailerService: ConfigMailerService,
  ) {}

  public async createAccessToken(user: Users): Promise<string> {
    return sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        lastlogin_at: user.lastlogin_at,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRATION,
      },
    );
  }

  public async validadeUser(jwtPayload: JwtPayload): Promise<SigninDto> {
    const user = await this.usersRepository.findOneBy({ id: jwtPayload.id });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return user;
  }

  public async signin(email: string, password: string) {
    const user = await this.findaByEmail(email);
    await this.checkPassword(password, user);

    const access_token = await this.createAccessToken(user);

    const updateLastLogin: UpdateUserDto = {
      lastlogin_at: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    };

    this.usersRepository.update(user.id, updateLastLogin);

    return {
      access_token,
    };
  }

  private async findaByEmail(email: string): Promise<Users> {
    const user = await this.usersRepository.findOne({
      where: { email, status: 1 },
      select: ['id', 'name', 'email', 'password', 'lastlogin_at'],
    });

    if (!user) throw new BadRequestException('Não existe nenhum usuário com este email!');

    return user;
  }

  private async checkPassword(password: string, user: Users): Promise<boolean> {
    const match = await bcrypt.compare(password, user.password);

    if (!match) throw new BadRequestException('Senha incorreta!');

    return match;
  }

  async forgottenPassword(email: string): Promise<void> {
    const user = await this.findaByEmail(email);
    await this.mailerService.SendForgottenPassword(user.name, user.id, user.email);
    const altRequestPassword = {
      ...user,
      is_requestpassword: 1,
    };

    await this.usersRepository.update(user.id, altRequestPassword);
  }
}
