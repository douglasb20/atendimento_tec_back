import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtendimentosService } from './atendimentos.service';
import { AtendimentosController } from './atendimentos.controller';
import { AtendimentoStatusEntity } from './entities/atendimento-status.entity';
import { AtendimentosEntity } from './entities/atendimento.entity';
import { UsersEntity } from 'users/entities/users.entity';
import { ClientsEntity } from 'client/entities/clients.entity';
import { ContactsEntity } from 'client/entities/contacts.entity';
import { AtendimentosServicosEntity } from './entities/atendimento-servico.entity';
import { AtendimentoRepository } from './atendimentos.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtendimentosEntity,
      AtendimentoStatusEntity,
      UsersEntity,
      ClientsEntity,
      ContactsEntity,
      AtendimentosServicosEntity,
    ]),
  ],
  controllers: [AtendimentosController],
  providers: [AtendimentosService, AtendimentoRepository],
})
export class AtendimentosModule {}
