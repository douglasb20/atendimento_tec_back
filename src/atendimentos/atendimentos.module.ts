import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtendimentosService } from './atendimentos.service';
import { AtendimentosController } from './atendimentos.controller';
import { AtendimentoStatusEntity } from './entities/atendimento-status.entity';
import { AtendimentosEntity } from './entities/atendimento.entity';
import { Users } from 'users/entities/users.entity';
import { Clients } from 'client/entities/clients.entity';
import { Contacts } from 'client/entities/contacts.entity';
import { AtendimentosServicosEntity } from './entities/atendimento-servico.entity';
import { AtendimentoRepository } from './atendimentos.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AtendimentosEntity,
      AtendimentoStatusEntity,
      Users,
      Clients,
      Contacts,
      AtendimentosServicosEntity,
    ]),
  ],
  controllers: [AtendimentosController],
  providers: [AtendimentosService, AtendimentoRepository],
})
export class AtendimentosModule {}
