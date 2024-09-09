import { Module } from '@nestjs/common';
import { ClientService } from './client.service';
import { ClientController } from './client.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clients } from './entities/clients.entity';
import { Contacts } from './entities/contacts.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Clients, Contacts])],
  controllers: [ClientController],
  providers: [ClientService],
})
export class ClientModule {}
