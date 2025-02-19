import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AtendimentosService } from './atendimentos.service';
import { AtendimentosController } from './atendimentos.controller';
import { AtendimentoStatus } from './entities/atendimento-status-entity';
import { Atendimentos } from './entities/atendimento-entity';
import { Users } from 'users/entities/users.entity';
import { Clients } from 'client/entities/clients.entity';
import { Contacts } from 'client/entities/contacts.entity';
import { AtendimentosServicos } from './entities/atendimento-servico-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Atendimentos,
      AtendimentoStatus,
      Users,
      Clients,
      Contacts,
      AtendimentosServicos,
    ]),
  ],
  controllers: [AtendimentosController],
  providers: [AtendimentosService],
})
export class AtendimentosModule {}
