import { runInTransaction } from '@/Utils';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { Clients } from 'clients/entities/clients.entity';
import { DataSource, EntityManager } from 'typeorm';
import { WhatsappService } from 'whatsapp/whatsapp.service';
import { CustomFieldsService } from '@/custom-fields/custom-fields.service';
import { ContactsRepository } from './contacts.repository';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { Contacts } from './entities/contacts.entity';

/**
 * Telefone em dígitos, com o DDI do Brasil quando for um número nacional.
 *
 * A máscara do formulário é nacional - `(64) 99269-8043` -, mas o WhatsApp
 * identifica o contato pelo número internacional: sem o `55` a verificação
 * responde que não existe, e um número válido seria marcado como sem WhatsApp.
 *
 * Só acrescenta o prefixo a 10 ou 11 dígitos, que é o formato nacional (DDD +
 * 8 ou 9). Qualquer outro tamanho passa intacto: um `+1 555 123 4567` também
 * tem 11 dígitos depois do `+`, mas já começa com o DDI dele, e prefixá-lo
 * produziria um número diferente do digitado.
 */
function comDdiBrasil(telefone?: string): string {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  if (!digitos) return '';

  // Começar com 55 e ter 12 ou 13 dígitos já é o formato final.
  if (digitos.startsWith('55') && digitos.length >= 12) return digitos;

  // O `+` marca que quem digitou informou o país - respeitar sempre.
  if (telefone?.trim().startsWith('+')) return digitos;

  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private contactRepository: ContactsRepository,
    private whatsappService: WhatsappService,
    private customFieldsService: CustomFieldsService,
    private dataSource: DataSource,
  ) {}

  async getAllContacts() {
    // `camposPersonalizados` vem junto: a listagem os exibe, e buscá-los
    // depois seria uma consulta por linha.
    return this.contactRepository.find({
      where: { status: 1 },
      relations: ['camposPersonalizados'],
      order: { name: 'ASC' },
    });
  }

  async saveContactsFromClient(contacts: CreateContactsDto[], client: Clients) {
    const contactsNew = contacts.map((contact) => ({
      ...contact,
      ...(contact.id !== undefined && { id: Number(contact.id) }),
      client_id: client.id,
    })) as Contacts[];

    return await this.contactRepository.save(contactsNew);
  }

  /**
   * Cadastro manual de contato, pela tela.
   *
   * Antes de gravar, pergunta ao provider se o número tem WhatsApp e qual é o
   * JID. Sem isso o contato nasceria sem `remote_jid`, e a primeira mensagem
   * dele criaria um segundo registro - o `findOrCreateByRemoteJid` busca só por
   * esse campo. Montar o JID concatenando o telefone erraria: o nono dígito dos
   * celulares brasileiros nem sempre coincide com o que o WhatsApp usa.
   *
   * A verificação é informativa, nunca bloqueante. Número sem WhatsApp, provider
   * fora do ar ou nenhum canal conectado: o contato é gravado do mesmo jeito,
   * com `remote_jid` nulo, e a resposta diz o que aconteceu.
   */
  async createContact(createContactDto: CreateContactsDto): Promise<Contacts & { aviso?: string }> {
    const numero = comDdiBrasil(createContactDto.phone);
    const verificado = numero ? await this.whatsappService.verificaNumero(numero) : null;

    if (numero && !verificado) {
      this.logger.warn(`Contato ${createContactDto.name}: número ${numero} não pôde ser verificado`);
    }

    const contact = await runInTransaction(this.dataSource, async (manager) => {
      const jid = verificado?.existe ? verificado.remoteJid : null;

      // Um contato com este JID já existe quando a pessoa já escreveu: nesse
      // caso a tela estaria criando uma duplicata do que o webhook já criou.
      if (jid) {
        const existente = await manager.findOneBy(Contacts, { remote_jid: jid });
        if (existente) {
          throw new ConflictException(
            `Este número já está cadastrado no contato "${existente.name}"`,
          );
        }
      }

      // O número que o WhatsApp reconheceu ganha do digitado: o provider
      // devolve a forma canônica, e ela pode divergir - o nono dígito de
      // celulares antigos existe no discado e não no JID. Gravar o digitado
      // deixaria `phone` e `remote_jid` apontando para números diferentes.
      const numeroCanonico = jid ? jid.split('@')[0] : numero;

      const novo = manager.create(Contacts, {
        name: createContactDto.name,
        phone: numeroCanonico || null,
        client_id: createContactDto.client_id ?? null,
        remote_jid: jid,
        status: 1,
      });

      const salvo = await manager.save(Contacts, novo);

      // Validado antes de gravar: um valor fora do tipo derruba a transação
      // inteira, e o contato não fica meio criado.
      if (createContactDto.campos?.length) {
        const valores = await this.customFieldsService.validaValores(
          createContactDto.campos,
          'contato',
          manager,
        );

        await this.customFieldsService.sincronizaValores(salvo.id, valores, 'contato', manager);
      }

      return salvo;
    });

    this.logger.log(`Contato ${contact.id} criado (remote_jid=${contact.remote_jid ?? 'nenhum'})`);

    // O aviso vai junto do contato, não como erro: o cadastro deu certo, e a
    // tela decide como contá-lo a quem cadastrou.
    if (!numero) return contact;
    if (!verificado) {
      return Object.assign(contact, {
        aviso: 'Não foi possível verificar o número no WhatsApp agora. O contato foi salvo.',
      });
    }
    if (!verificado.existe) {
      return Object.assign(contact, {
        aviso: 'Este número não tem WhatsApp. O contato foi salvo, mas não receberá mensagens.',
      });
    }

    return contact;
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

        // Só mexe nos campos quando vêm no corpo: um PATCH que não os mencione
        // deixa os valores como estão.
        if (updateContactDto.campos) {
          const valores = await this.customFieldsService.validaValores(
            updateContactDto.campos,
            'contato',
            manager,
          );

          await this.customFieldsService.sincronizaValores(
            contact_id,
            valores,
            'contato',
            manager,
          );
        }

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
    return this.contactRepository.find({
      where: { client_id, status: 1 },
      relations: ['camposPersonalizados'],
      order: { name: 'ASC' },
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
