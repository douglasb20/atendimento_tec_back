import { runInTransaction } from '@/Utils';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Clients } from 'clients/entities/clients.entity';
import { DataSource, EntityManager } from 'typeorm';
import { WhatsappService } from 'whatsapp/whatsapp.service';
import { ContactsRepository } from './contacts.repository';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { Contacts } from './entities/contacts.entity';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private contactRepository: ContactsRepository,
    private whatsappService: WhatsappService,
    private dataSource: DataSource,
  ) {}

  async getAllContacts() {
    return this.contactRepository.findBy({ status: 1 });
  }

  async saveContactsFromClient(contacts: CreateContactsDto[], client: Clients) {
    const contactsNew = contacts.map((contact) => ({
      ...contact,
      ...(contact.id !== undefined && { id: Number(contact.id) }),
      client_id: client.id,
    })) as Contacts[];

    return await this.contactRepository.save(contactsNew);
  }

  async deleteContact(contact_id: number) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        await this.contactRepository.deleteContact(contact_id, manager);
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async updateContact(
    updateContactDto: UpdateContactsDto,
    contact_id: number,
    client_id: number = null,
  ) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const contact = await this.contactRepository.updateContact(
          contact_id,
          updateContactDto,
          manager,
          client_id,
        );

        // Recarregado com a relação: o `save` devolve só as colunas, e quem
        // acabou de associar um cliente precisa do nome dele para exibir.
        return (await this.contactRepository.findByIdComCliente(contact.id, manager)) ?? contact;
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async getAllContactsByClients(client_id: number) {
    return this.contactRepository.findBy({
      client_id: client_id,
      status: 1,
    });
  }

  async findOrCreateByRemoteJid(
    {
      sessionId,
      remote_jid,
      name,
    }: {
      sessionId: string;
      remote_jid: string;
      name?: string;
    },
    manager: EntityManager,
  ): Promise<Contacts> {
    let contact = await manager.findOneBy(Contacts, { remote_jid });

    // Diagnóstico do avatar genérico: sem isto não dá para distinguir "contato
    // novo", "já tinha foto" e "tem o campo vazio e vai reconsultar" — os três
    // caminhos são silenciosos e levam ao mesmo resultado na tela.
    this.logger.debug(
      `findOrCreateByRemoteJid ${remote_jid}: ` +
        (contact
          ? `contato ${contact.id} existente, avatar_url=${JSON.stringify(contact.avatar_url)}`
          : 'contato novo'),
    );

    if (!contact) {
      const phone = await this.whatsappService.getFormattedNumber(sessionId, remote_jid);
      const profilePicUrl = await this.whatsappService.getProfilePicUrl(sessionId, remote_jid);
      contact = manager.create(Contacts, {
        remote_jid,
        name,
        phone,
        avatar_url: profilePicUrl,
        is_avatar_external: true,
        status: 1,
      });

      await manager.save(Contacts, contact);
      return contact;
    }

    // Contato já existente sem foto: tenta de novo.
    //
    // A busca acontecia só na criação, então um contato criado enquanto a
    // instância ainda subia — ou antes de o dono publicar uma foto — ficava com
    // o avatar genérico para sempre, por mais conversas que tivesse depois.
    //
    // Só quando está vazia: refazer a chamada em toda mensagem somaria uma ida
    // à Evolution por mensagem recebida, e a foto muda raramente.
    if (!contact.avatar_url) {
      const profilePicUrl = await this.whatsappService.getProfilePicUrl(sessionId, remote_jid);

      if (profilePicUrl) {
        contact.avatar_url = profilePicUrl;
        contact.is_avatar_external = true;
        await manager.save(Contacts, contact);
        this.logger.log(`Foto de perfil preenchida para o contato ${contact.id}`);
      }
    }

    return contact;
  }
}
