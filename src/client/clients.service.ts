import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ClientsEntity } from './entities/clients.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { ContactsEntity } from './entities/contacts.entity';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { ClientRepository } from './clients.repository';
import { ContactRepository } from './contacts.repository';

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

      if (
        'contacts' in createClientDto &&
        createClientDto?.contacts !== null &&
        createClientDto?.contacts?.length !== 0
      ) {
        client.contacts = await this.saveContact(client, createClientDto.contacts);
      }

      await this.query.commitTransaction();
      return client;
    } catch (err) {
      await this.query.rollbackTransaction();
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

      const addedClient = await this.query.manager.save(ClientsEntity, clientNew);

      if ('contacts' in updateClientDto && updateClientDto?.contacts) {
        if (updateClientDto?.contacts.length > 0) {
          await this.saveContact(addedClient, updateClientDto.contacts);
        }
      }

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

      await this.query.manager.save(ClientsEntity, {
        ...client,
        status: 0,
      });
      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      throw new BadRequestException(err.message);
    }
  }

  async findAll() {
    return this.query.manager.findBy(ClientsEntity, {
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

  async deleteContact(client_id: string, contact_id: string) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.findOneBy({ id: +client_id });
      if (!client) {
        this.logger.error(`Erro de remover cliente: Cliente com id "${client_id}" não existe`);
        throw new Error(`Cliente com id "${client_id}" não existe.`);
      }

      const contact = await this.contactRepository.findOneBy({
        id: +contact_id,
        client_id: client.id,
      });
      if (!contact) {
        this.logger.error(`Erro de salvar cliente: Contato com id "${client_id}" não existe`);
        throw new Error(`Contato com id "${contact_id}" não existe.`);
      }

      await this.query.manager.delete(ContactsEntity, contact_id);

      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      throw new BadRequestException(err.message);
    }
  }

  async updateContact(updateContactDto: UpdateContactsDto, client_id: string, contact_id: string) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.findOneBy({ id: +client_id });
      if (!client) {
        this.logger.error(`Erro de atualizar cliente: Cliente com id "${client_id}" não existe`);
        throw new Error(`Cliente com id "${client_id}" não existe.`);
      }

      const contact = await this.contactRepository.findOneBy({
        id: +contact_id,
        client_id: client.id,
      });
      if (!contact) {
        this.logger.error(`Erro de atualizar cliente: Contato com id "${client_id}" não existe`);
        throw new Error(`Contato com id "${contact_id}" não existe.`);
      }

      await this.query.manager.save(ContactsEntity, {
        ...contact,
        ...updateContactDto,
      });

      await this.query.commitTransaction();
      return { ...contact, ...updateContactDto };
    } catch (err) {
      await this.query.rollbackTransaction();
      throw new BadRequestException(err.message);
    }
  }

  async getAllContactsByClients(client_id: string) {
    return this.contactRepository.findBy({
      client_id: +client_id,
      status: 1,
    });
  }

  async saveContact(client: ClientsEntity, contacts: CreateContactsDto[]) {
    const contactsNew = contacts.map((contact) => ({
      ...contact,
      ...(contact.id !== undefined && { id: Number(contact.id) }),
      client_id: client.id,
    })) as ContactsEntity[];

    return await this.query.manager.save(ContactsEntity, contactsNew);
  }
}
