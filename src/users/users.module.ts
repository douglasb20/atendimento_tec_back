import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersEntity } from './entities/users.entity';
import { ConfigMailerModule } from 'mailer/configmailer.module';
import { AtendimentosEntity } from 'atendimentos/entities/atendimento.entity';
import { UserRepository } from './users.repository';

@Module({
  imports: [TypeOrmModule.forFeature([UsersEntity, AtendimentosEntity]), ConfigMailerModule],
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
})
export class UsersModule {}
