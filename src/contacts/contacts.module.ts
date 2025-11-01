import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clients } from 'clients/entities/clients.entity';
import { Contacts } from './entities/contacts.entity';
import { ContactRepository } from './contacts.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Clients, Contacts])],
  controllers: [ContactsController],
  providers: [ContactsService, ContactRepository],
  exports: [ContactsService],
})
export class ContactsModule {}
