import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Clients } from './entities/clients.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { Contacts } from './entities/contacts.entity';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateContactsDto } from './dto/create-contacts.dto';

@Injectable()
export class ClientService {
  private query: QueryRunner;
  constructor(
    @InjectRepository(Clients) private clientRepository: Repository<Clients>,
    @InjectRepository(Contacts) private contactRepository: Repository<Contacts>,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async createClient(createClientDto: CreateClientDto) {
    try {
      await this.query.startTransaction();
      const client = this.clientRepository.create({
        nome: createClientDto.nome,
        cnpj: createClientDto.cnpj,
      });

      await this.query.manager.save(Clients, client);

      if ('contacts' in createClientDto && createClientDto?.contacts !== null && createClientDto?.contacts?.length !== 0) {
        client.contacts = await this.saveContact(client, createClientDto.contacts);
      }

      await this.query.commitTransaction();
      return client;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async updateClient(client_id: number, updateClientDto: UpdateClientDto) {
    try {
      await this.query.startTransaction();
      const client = await this.clientRepository.findOneBy({ id: client_id });
      if (!client) {
        throw new BadRequestException(`Cliente com id "${client_id}" não existe.`);
      }

      const clientNew = {
        ...client,
        nome: updateClientDto.nome,
        cnpj: updateClientDto.cnpj,
      };

      const addedClient = await this.query.manager.save(Clients, clientNew);

      if ('contacts' in updateClientDto && updateClientDto.contacts?.length !== 0) {
        await this.saveContact(addedClient, updateClientDto.contacts);
      }

      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async removeClient(client_id: number) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.findOneBy({ id: Number(client_id) });
      if (!client) {
        throw new BadRequestException(`Cliente com id "${client_id}" não existe.`);
      }

      await this.query.manager.save(Clients, {
        ...client,
        status: 0,
      });
      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async findAll() {
    return this.clientRepository.findBy({
      status: 1,
    },
    );
  }

  async findOne(client_id: number) {
    const client = await this.clientRepository.findOneBy({ id: client_id });
    if (!client) {
      throw new BadRequestException(`Cliente com id "${client_id}" não existe.`);
    }
    const contacts = await this.contactRepository.findBy({ clients: client, status: 1 });
    client.contacts = contacts;
    return client;
  }

  async deleteContact(client_id: string, contact_id: string) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.findOneBy({ id: +client_id });
      if (!client) {
        throw new BadRequestException(`Cliente com id "${client_id}" não existe.`);
      }

      const contact = await this.contactRepository.findOneBy({
        id: +contact_id,
        clients_id: client.id,
      });
      if (!contact) {
        throw new BadRequestException(`Contato com id "${contact_id}" não existe.`);
      }

      await this.query.manager.save(Contacts, {
        ...contact,
        status: 0,
      });

      await this.query.commitTransaction();
      return {
        ...contact,
        status: 0,
      };
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async updateContact(updateContactDto: UpdateContactsDto, client_id: string, contact_id: string) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.findOneBy({ id: +client_id });
      if (!client) {
        throw new BadRequestException(`Cliente com id "${client_id}" não existe.`);
      }

      const contact = await this.contactRepository.findOneBy({
        id: +contact_id,
        clients_id: client.id,
      });
      if (!contact) {
        throw new BadRequestException(`Contato com id "${contact_id}" não existe.`);
      }

      await this.query.manager.save(Contacts, {
        ...contact,
        ...updateContactDto,
      });

      await this.query.commitTransaction();
      return { ...contact, ...updateContactDto };
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async getAllContactsByClients(client_id: string) {
    return this.contactRepository.findBy({
      clients_id: +client_id,
      status: 1
    })
  }

  async saveContact(client: Clients, contacts: CreateContactsDto[]) {
    const contactsNew = contacts.map((contact) => ({
      ...contact,
      ...(contact.id !== undefined && { id: Number(contact.id) }),
      clients: client
    })) as Contacts[];

    return await this.query.manager.save(Contacts, contactsNew);
  }
}
