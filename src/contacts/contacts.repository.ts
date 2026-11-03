import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UpdateContactsDto } from 'contacts/dto/update-contacts.dto';
import { Contacts } from 'contacts/entities/contacts.entity';
import { permiteAutomacaoContato } from './politica-atendimento';

@Injectable()
export class ContactsRepository extends Repository<Contacts> {
  private readonly logger = new Logger(ContactsRepository.name);
  constructor(dataSource: DataSource) {
    super(Contacts, dataSource.manager);
  }

  async findActives() {
    return this.findBy({ status: 1 });
  }

  async permiteAutomacao(id: number, manager?: EntityManager): Promise<boolean> {
    const contato = await (manager ?? this.manager).findOne(Contacts, {
      where: { id }, select: { id: true, ignore_support: true, automation_disabled: true },
    });
    return permiteAutomacaoContato(contato);
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

  async updateContact(
    id: number,
    updateContactDto: UpdateContactsDto,
    manager: EntityManager,
    client_id: number = null,
  ) {
    const contact = await this.findById(id);
    if (!contact) {
      this.logger.error(`Erro de atualizar contato: Contato não localizado com este id`);
      throw new BadRequestException('Contato não localizado com este id');
    }
    const updateContact = this.create({
      id,
      ...updateContactDto,
      ...(client_id !== null && { client_id: client_id }),
      // Marcar sem cliente precisa remover o vínculo, inclusive em formulários
      // antigos que omitem client_id ao limpar a seleção.
      ...(updateContactDto.has_no_client === true && { client_id: null }),
    });
    // PATCH de foto/nome não pode regravar uma política antiga lida antes
    // de outra edição concorrente. Só os campos enviados são persistidos.
    await manager.save(Contacts, updateContact);
    return manager.findOneBy(Contacts, { id });
  }

  /**
   * Contato com o cliente carregado - o que o front precisa para exibir o nome.
   *
   * Recebe o `manager` porque é chamado de dentro da transação de atualização:
   * lendo pelo repositório, a consulta cai fora dela e devolve o estado
   * anterior ao commit.
   */
  async findByIdComCliente(id: number, manager?: EntityManager) {
    const origem = manager ?? this.manager;
    return origem.findOne(Contacts, {
      where: { id },
      relations: ['client', 'camposPersonalizados'],
    });
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
