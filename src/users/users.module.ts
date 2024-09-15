import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { ConfigMailerModule } from 'mailer/configmailer.module';
import { Atendimentos } from 'atendimentos/entities/atendimento-entity';

@Module({
  imports: [TypeOrmModule.forFeature([Users, Atendimentos]), ConfigMailerModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
