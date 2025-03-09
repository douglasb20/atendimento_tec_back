import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from './entities/users.entity';
import { ConfigMailerModule } from 'mailer/configmailer.module';
import { AtendimentosEntity } from 'atendimentos/entities/atendimento.entity';
import { UserRepository } from './users.repository';
import { UserRefreshTokensEntity } from './entities/user-refresh-tokens.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UsersEntity, AtendimentosEntity, UserRefreshTokensEntity]), ConfigMailerModule],
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
})
export class UsersModule {}
