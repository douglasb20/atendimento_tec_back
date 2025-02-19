import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Clients } from './entities/clients.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';


@Injectable()
export class ClientRepository extends Repository<Clients> {
  private readonly logger = new Logger(ClientRepository.name);
  constructor(dataSource: DataSource) {
    super(Clients, dataSource.manager);
  }

  async findActives() {
    return this.findBy({ status: 1 });
  }

  async findById(id: number) {
    const client = await this.findOne({ where: { id: id } });
    if (!client) {
      this.logger.error(`Erro de atualizar usuário: Cliente não localizado com este id`);
      throw new BadRequestException('Cliente não localizado com este id');
    }
    return client;
  }

  async createClient(client: CreateClientDto, manager: EntityManager) {
    const newClient = this.create({
      ...client,
    });
    return await manager.save(Clients, newClient);
  }

  async updateClient(id: number, updateClientDto: UpdateClientDto, manager: EntityManager) {
    const client = await this.findById(id);
    if (!client) {
      this.logger.error(`Erro de atualizar cliente: Cliente não localizado com este id`);
      throw new BadRequestException('Cliente não localizado com este id');
    }
    const updateClient = this.create({
      ...client,
      ...updateClientDto,
    });
    return await manager.save(Clients, updateClient);
  }

  async deleteClient(id: number, manager: EntityManager) {
    const client = await this.findById(id);
    if (!client) {
      this.logger.error(`Erro de deletar cliente: Cliente não localizado com este id`);
      throw new BadRequestException('Cliente não localizado com este id');
    }

    const updateClient = {
      ...client,
      status: 0,
    };
    return await manager.save(Clients, updateClient);
  }
}
