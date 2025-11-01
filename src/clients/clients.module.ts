import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientService } from './clients.service';
import { ClientController } from './clients.controller';
import { ClientRepository } from './clients.repository';
import { Clients } from './entities/clients.entity';

import { Supports } from 'supports/entities/supports.entity';
import { Contacts } from 'contacts/entities/contacts.entity';
import { ContactRepository } from 'contacts/contacts.repository';
import { ContactsModule } from 'contacts/contacts.module';

@Module({
  imports: [TypeOrmModule.forFeature([Clients, Contacts, Supports]), ContactsModule],
  controllers: [ClientController],
  providers: [ClientService, ClientRepository, ContactRepository],
})
export class ClientModule { }
