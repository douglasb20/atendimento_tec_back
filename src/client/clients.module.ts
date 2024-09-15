import { Module } from '@nestjs/common';
import { ClientService } from './clients.service';
import { ClientController } from './clients.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clients } from './entities/clients.entity';
import { Contacts } from './entities/contacts.entity';
import { Atendimentos } from 'atendimentos/entities/atendimento-entity';

@Module({
  imports: [TypeOrmModule.forFeature([Clients, Contacts, Atendimentos])],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
