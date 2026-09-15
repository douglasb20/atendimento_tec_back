import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ClientRepository } from './clients.repository';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Clients } from './entities/clients.entity';

import { runInTransaction } from '@/Utils';
import { ContactsRepository } from 'contacts/contacts.repository';
import { TagsRepository } from '@/tags/tags.repository';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);
  constructor(
    private clientRepository: ClientRepository,
    private contactRepository: ContactsRepository,
    private tagsRepository: TagsRepository,
    private dataSource: DataSource,
  ) {}

  async createClient(createClientDto: CreateClientDto) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const client = await this.clientRepository.createClient(createClientDto, manager);

        if (createClientDto.tag_ids) {
          await this.gravaEtiquetas(client, createClientDto.tag_ids, manager);
        }

        return client;
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async updateClient(client_id: number, updateClientDto: UpdateClientDto) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
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

        await manager.save(Clients, clientNew);

        // Só mexe nas etiquetas quando o campo vem no corpo: um PATCH que não
        // as mencione deixa os vínculos como estão.
        if (updateClientDto.tag_ids) {
          await this.gravaEtiquetas(client, updateClientDto.tag_ids, manager);
        }
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  /**
   * Substitui as etiquetas do cliente pelas informadas.
   *
   * Ids que já não existem são descartados em silêncio — a tela pode ter sido
   * carregada antes de alguém remover a etiqueta, e derrubar o salvamento
   * inteiro por isso seria pior do que ignorar.
   */
  /**
   * Substitui as etiquetas do cliente e devolve o cliente atualizado.
   *
   * Existe separado do `updateClient` para o painel do chat poder classificar o
   * cliente sem reenviar nome e CNPJ — que ele nem tem em mãos.
   */
  async atualizarEtiquetas(client_id: number, tagIds: number[]): Promise<Clients> {
    return runInTransaction(this.dataSource, async (manager) => {
      const client = await this.clientRepository.findById(client_id);

      await this.gravaEtiquetas(client, tagIds, manager);

      this.logger.log(`Etiquetas do cliente ${client_id} atualizadas: ${tagIds.length}`);

      // A releitura usa o manager da transação: o repository comum abriria
      // outra conexão e não enxergaria a alteração ainda não commitada.
      return manager.findOne(Clients, { where: { id: client_id }, relations: ['tags'] });
    });
  }

  private async gravaEtiquetas(client: Clients, tagIds: number[], manager: EntityManager) {
    const tags = await this.tagsRepository.findByIds(tagIds, manager);

    await manager.save(Clients, { ...client, tags });
  }

  async removeClient(client_id: number) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const client = await this.clientRepository.findOneBy({ id: Number(client_id) });
        if (!client) {
          this.logger.error(`Erro de remover cliente: Cliente com id "${client_id}" não existe`);
          throw new Error(`Cliente com id "${client_id}" não existe.`);
        }

        await manager.save(Clients, {
          ...client,
          status: 0,
        });
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async findAll() {
    return this.clientRepository.findActives();
  }

  async findOne(client_id: number) {
    // `findById` carrega as etiquetas; o `findOneBy` que estava aqui não trazia
    // relação nenhuma.
    const client = await this.clientRepository.findOne({
      where: { id: client_id },
      relations: ['tags'],
    });
    if (!client) {
      this.logger.error(`Erro de localizar cliente: Cliente com id "${client_id}" não existe`);
      throw new BadRequestException(`Cliente com id "${client_id}" não existe.`);
    }
    // Filtra pelo id, não pelo objeto: passar a entidade inteira faz o TypeORM
    // montar a condição a partir de todos os campos carregados — e desde que o
    // cliente passou a vir com as etiquetas, a comparação nunca casava.
    const contacts = await this.contactRepository.findBy({ client_id: client.id, status: 1 });
    client.contacts = contacts;
    return client;
  }
}
