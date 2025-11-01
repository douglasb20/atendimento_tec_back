import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UpdateContactsDto } from 'contacts/dto/update-contacts.dto';
import { Contacts } from 'contacts/entities/contacts.entity';

@Injectable()
export class ContactRepository extends Repository<Contacts> {
  private readonly logger = new Logger(ContactRepository.name);
  constructor(dataSource: DataSource) {
    super(Contacts, dataSource.manager);
  }

  async findActives() {
    return this.findBy({ status: 1 });
  }

  async findById(id: number) {
    const contact = await this.findOne({ where: { id: id } });
    if (!contact) {
      this.logger.error(`Erro de atualizar contato: Contato não localizado com este id`);
      throw new BadRequestException('Contato não localizado com este id');
    }
    return contact;
  }

  // async createContact(createContactDto: CreateContactsDto, manager: EntityManager) {
  //   const contact = this.create();
  //   return await manager.save(ContactsEntity, contact);
  // }

  async updateContact(id: number, updateContactDto: UpdateContactsDto, manager: EntityManager, client_id: number = null) {
    const contact = await this.findById(id);
    if (!contact) {
      this.logger.error(`Erro de atualizar contato: Contato não localizado com este id`);
      throw new BadRequestException('Contato não localizado com este id');
    }
    const updateContact = this.create({
      ...contact,
      ...updateContactDto,
      ...(client_id !== null && { client_id: client_id }),
    });
    return await manager.save(Contacts, updateContact);
  }

  async deleteContact(id: number, manager: EntityManager) {
    const contact = await this.findById(id);
    if (!contact) {
      this.logger.error(`Erro de deletar contato: Contato não localizado com este id`);
      throw new BadRequestException('Contato não localizado com este id');
    }

    const updateContact = {
      ...contact,
      status: 0,
    };
    return await manager.save(Contacts, updateContact);
  }
}
