import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'users/entities/users.entity';
import { ConfigMailerModule } from 'mailer/configmailer.module';
import { ConfigMailerService } from 'mailer/configmailer.service';

@Module({
  imports: [TypeOrmModule.forFeature([Users]), ConfigMailerModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ConfigMailerService],
})
export class AuthModule {}
