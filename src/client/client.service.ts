import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Clients } from './entities/clients.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { Contacts } from './entities/contacts.entity';

@Injectable()
export class ClientService {
  private query: QueryRunner;
  constructor(
    @InjectRepository(Clients) private repository: Repository<Clients>,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async createClient(createClientDto: CreateClientDto) {
    await this.query.startTransaction();
    try {
      const client = this.repository.create({
        nome: createClientDto.nome,
        cnpj: createClientDto.cnpj,
      });

      await this.query.manager.save(Clients, client);

      if (createClientDto.contacts.length !== 0) {
        const contactsNew = createClientDto.contacts.map((contact) => ({
          nome_contato: contact.nome_contato,
          clients: client,
          telefone_contato: contact.telefone_contato,
        }));
        await this.query.manager.save(Contacts, contactsNew);
      }

      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }
}
