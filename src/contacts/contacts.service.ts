import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Clients } from 'clients/entities/clients.entity';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { Contacts } from './entities/contacts.entity';
import { ContactsRepository } from './contacts.repository';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { WhatsappService } from 'whatsapp/whatsapp.service';

@Injectable()
export class ContactsService {
  private query: QueryRunner;
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private contactRepository: ContactsRepository,
    private whatsappService: WhatsappService,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async getAllContacts() {
    return this.contactRepository.findBy({ status: 1 });
  }

  async saveContactsFromClient(contacts: CreateContactsDto[], client: Clients) {
    const contactsNew = contacts.map((contact) => ({
      ...contact,
      ...(contact.id !== undefined && { id: Number(contact.id) }),
      client_id: client.id,
    })) as Contacts[];

    return await this.query.manager.save(Contacts, contactsNew);
  }

  async deleteContact(contact_id: number) {
    try {
      await this.query.startTransaction();

      await this.contactRepository.deleteContact(contact_id, this.query.manager);

      await this.query.commitTransaction();
    } catch (err) {
      await this.query.rollbackTransaction();
      this.logger.error(err.message);
      throw new BadRequestException(err.message);
    }
  }

  async updateContact(
    updateContactDto: UpdateContactsDto,
    contact_id: number,
    client_id: number = null,
  ) {
    try {
      await this.query.startTransaction();

      const contact = await this.contactRepository.updateContact(
        contact_id,
        updateContactDto,
        this.query.manager,
        client_id,
      );

      await this.query.commitTransaction();
      return { ...contact, ...updateContactDto };
    } catch (err) {
      await this.query.rollbackTransaction();
      this.logger.error(err.message);
      throw new BadRequestException(err.message);
    }
  }

  async getAllContactsByClients(client_id: number) {
    return this.contactRepository.findBy({
      client_id: client_id,
      status: 1,
    });
  }

  async findOrCreateByRemoteJid({
    sessionId,
    remote_jid,
    name,
  }: {
    sessionId: string;
    remote_jid: string;
    name?: string;
  }) {
    let contact = await this.contactRepository.findOneBy({ remote_jid });

    if (!contact) {
      const phone = await this.whatsappService.getFormattedNumber(sessionId, remote_jid);
      const profilePicUrl = await this.whatsappService.getProfilePicUrl(sessionId, remote_jid);
      contact = this.contactRepository.create({
        remote_jid,
        name,
        phone,
        avatar_url: profilePicUrl,
        is_avatar_external: true,
        status: 1,
      });
      await this.contactRepository.save(contact);
    }
    return contact;
  }
}
