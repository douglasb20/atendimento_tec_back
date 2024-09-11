import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Clients } from './entities/clients.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { Contacts } from './entities/contacts.entity';
import { UpdateContactsDto } from './dto/update-contacts.dto';

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

      if ('contacts' in createClientDto && createClientDto.contacts?.length !== 0) {
        await this.createContactByClient(client, createClientDto.contacts);
      }

      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async findAll() {
    return this.clientRepository.find({
      where: {
        status: 1
      }
    })
  }

  async deleteContact(client_id: string, contact_id: string) {
    try {
      await this.query.startTransaction();

      const client = await this.clientRepository.findOneBy({ id: +client_id });
      if (!client) {
        throw new BadRequestException(`Cliente com id "${client_id} não existe."`);
      }

      const contact = await this.contactRepository.findOneBy({ id: +contact_id, clients_id: client.id });
      if (!contact) {
        throw new BadRequestException(`Contato com id "${contact_id}" não existe.`);
      }

      await this.query.manager.save(Contacts, {
        ...contact,
        status: 0
      })

      await this.query.commitTransaction();
      return ({
        ...contact,
        status: 0
      });
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
        throw new BadRequestException(`Cliente com id "${client_id} não existe."`);
      }

      const contact = await this.contactRepository.findOneBy({ id: +contact_id, clients_id: client.id });
      if (!contact) {
        throw new BadRequestException(`Contato com id "${contact_id}" não existe.`);
      }

      await this.query.manager.save(Contacts, {
        ...contact,
        ...updateContactDto
      })

      await this.query.commitTransaction();
      return ({ ...contact, ...updateContactDto });
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async createContactByClient(client: Clients, contacts: Contacts[]) {
    const contactsNew = contacts.map((contact) => ({
      nome_contato: contact.nome_contato,
      clients_id: client.id,
      telefone_contato: contact.telefone_contato,
    })) as Contacts[];

    await this.query.manager.save(Contacts, contactsNew);
  }
}
