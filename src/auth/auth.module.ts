import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from 'users/entities/users.entity';
import { ConfigMailerService } from 'mailer/configmailer.service';
import { UserRepository } from 'users/users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UsersEntity])],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ConfigMailerService, UserRepository],
})
export class AuthModule {}
