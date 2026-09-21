import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clients } from 'clients/entities/clients.entity';
import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { ContactsController } from './contacts.controller';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';
import { Contacts } from './entities/contacts.entity';
import { CustomFieldsModule } from '@/custom-fields/custom-fields.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clients, Contacts]),
    forwardRef(() => WhatsappModule),
    CustomFieldsModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
  exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
