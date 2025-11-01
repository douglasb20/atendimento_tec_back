import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportsService } from './supports.service';
import { SupportsController } from './supports.controller';
import { SupportStatus } from './entities/support-status.entity';
import { Supports } from './entities/supports.entity';
import { Users } from 'users/entities/users.entity';
import { Clients } from 'clients/entities/clients.entity';
import { Contacts } from 'contacts/entities/contacts.entity';
import { SupportServices } from './entities/support-services.entity';
import { SupportRepository } from './supports.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supports, SupportStatus, Users, Clients, Contacts, SupportServices]),
  ],
  controllers: [SupportsController],
  providers: [SupportsService, SupportRepository],
})
export class SupportsModule {}
