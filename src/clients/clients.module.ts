import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientService } from './clients.service';
import { ClientController } from './clients.controller';
import { ClientRepository } from './clients.repository';
import { Clients } from './entities/clients.entity';

import { Supports } from 'supports/entities/supports.entity';
import { Contacts } from 'contacts/entities/contacts.entity';
import { ContactsRepository } from 'contacts/contacts.repository';
import { ContactsModule } from 'contacts/contacts.module';
import { TagsModule } from '@/tags/tags.module';
import { CustomFieldsModule } from '@/custom-fields/custom-fields.module';

@Module({
  imports: [CustomFieldsModule, TypeOrmModule.forFeature([Clients, Contacts, Supports]), ContactsModule, TagsModule],
  controllers: [ClientController],
  providers: [ClientService, ClientRepository, ContactsRepository],
})
export class ClientModule {}
