import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from 'users/entities/users.entity';
import { ConfigMailerService } from 'core/mailer/configmailer.service';
import { UserRepository } from 'users/users.repository';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UserRefreshTokens } from 'users/entities/user-refresh-tokens.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }), // Registra a estratégia
    TypeOrmModule.forFeature([Users, UserRefreshTokens]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('ACCESS_JWT_SECRET'),
        signOptions: { expiresIn: '30min' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ConfigMailerService, UserRepository],
  exports: [AuthService, JwtModule, PassportModule], // Exporte para ser usado em outros módulos
})
export class AuthModule {}
