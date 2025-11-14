import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ClientRepository } from './clients.repository';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Clients } from './entities/clients.entity';

import { runInTransaction } from '@/Utils';
import { ContactsRepository } from 'contacts/contacts.repository';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);
  constructor(
    private clientRepository: ClientRepository,
    private contactRepository: ContactsRepository,
    private dataSource: DataSource,
  ) {}

  async createClient(createClientDto: CreateClientDto) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const client = await this.clientRepository.createClient(createClientDto, manager);

        return client;
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async updateClient(client_id: number, updateClientDto: UpdateClientDto) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const client = await this.clientRepository.findOneBy({ id: client_id });
        if (!client) {
          this.logger.error(`Erro de salvar cliente: Cliente com id "${client_id}" não existe`);
          throw new Error(`Cliente com id "${client_id}" não existe.`);
        }

        const clientNew = {
          ...client,
          nome: updateClientDto.nome,
          cnpj: updateClientDto.cnpj,
        };

        await manager.save(Clients, clientNew);
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async removeClient(client_id: number) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const client = await this.clientRepository.findOneBy({ id: Number(client_id) });
        if (!client) {
          this.logger.error(`Erro de remover cliente: Cliente com id "${client_id}" não existe`);
          throw new Error(`Cliente com id "${client_id}" não existe.`);
        }

        await manager.save(Clients, {
          ...client,
          status: 0,
        });
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async findAll() {
    return this.clientRepository.findBy({
      status: 1,
    });
  }

  async findOne(client_id: number) {
    const client = await this.clientRepository.findOneBy({ id: client_id });
    if (!client) {
      this.logger.error(`Erro de localizar cliente: Cliente com id "${client_id}" não existe`);
      throw new BadRequestException(`Cliente com id "${client_id}" não existe.`);
    }
    const contacts = await this.contactRepository.findBy({ clients: client, status: 1 });
    client.contacts = contacts;
    return client;
  }
}
