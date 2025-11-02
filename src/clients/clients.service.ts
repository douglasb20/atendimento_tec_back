import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import { ClientRepository } from './clients.repository';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Clients } from './entities/clients.entity';

import { ContactRepository } from 'contacts/contacts.repository';

@Injectable()
export class ClientService {
  private query: QueryRunner;
  private readonly logger = new Logger(ClientService.name);
  constructor(
    private clientRepository: ClientRepository,
    private contactRepository: ContactRepository,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async createClient(createClientDto: CreateClientDto) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.createClient(createClientDto, this.query.manager);

      await this.query.commitTransaction();
      return client;
    } catch (err) {
      await this.query.rollbackTransaction();
      this.logger.error(err.message);
      throw new BadRequestException(err.message);
    }
  }

  async updateClient(client_id: number, updateClientDto: UpdateClientDto) {
    try {
      await this.query.startTransaction();
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

      await this.query.manager.save(Clients, clientNew);

      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      this.logger.error(err.message);
      throw new BadRequestException(err.message);
    }
  }

  async removeClient(client_id: number) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.findOneBy({ id: Number(client_id) });
      if (!client) {
        this.logger.error(`Erro de remover cliente: Cliente com id "${client_id}" não existe`);
        throw new Error(`Cliente com id "${client_id}" não existe.`);
      }

      await this.query.manager.save(Clients, {
        ...client,
        status: 0,
      });
      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      this.logger.error(err.message);
      throw new BadRequestException(err.message);
    }
  }

  async findAll() {
    return this.query.manager.findBy(Clients, {
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
