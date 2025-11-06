import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clients } from 'clients/entities/clients.entity';
import { Contacts } from './entities/contacts.entity';
import { ContactsRepository } from './contacts.repository';
import { WhatsappModule } from 'whatsapp/whatsapp.module';

@Module({
  imports: [TypeOrmModule.forFeature([Clients, Contacts]), WhatsappModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
  exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
