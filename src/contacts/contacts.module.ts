import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clients } from 'clients/entities/clients.entity';
import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { ContactsController } from './contacts.controller';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';
import { Contacts } from './entities/contacts.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Clients, Contacts]), forwardRef(() => WhatsappModule)],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
  exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
