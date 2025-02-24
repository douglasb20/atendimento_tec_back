import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientService } from './clients.service';
import { ClientController } from './clients.controller';
import { ClientsEntity } from './entities/clients.entity';
import { ContactsEntity } from './entities/contacts.entity';
import { AtendimentosEntity } from 'atendimentos/entities/atendimento.entity';
import { ClientRepository } from './clients.repository';
import { ContactRepository } from './contacts.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ClientsEntity, ContactsEntity, AtendimentosEntity])],
  controllers: [ClientController],
  providers: [ClientService, ClientRepository, ContactRepository],
})
export class ClientModule {}
