import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { AtendimentosEntity } from './entities/atendimento.entity';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AtendimentoListResponse } from 'interface';
import { AtendimentosServicosEntity } from './entities/atendimento-servico.entity';
import { ClientsEntity } from 'client/entities/clients.entity';
import { ContactsEntity } from 'client/entities/contacts.entity';
import { ServicesEntity } from 'service/entities/service.entity';
import { UsersEntity } from 'users/entities/users.entity';
import { CreateAtendimentoServicoDto } from './dto/create-atendimento-servico.dto';

@Injectable()
export class AtendimentoRepository extends Repository<AtendimentosEntity> {
  private readonly logger = new Logger(AtendimentoRepository.name);
  constructor(protected dataSource: DataSource) {
    super(AtendimentosEntity, dataSource.manager);
  }

  async findAtendimento(id: number): Promise<AtendimentoListResponse> {
    const query = this.queryAtendimento();
    const result = await query
      .where(`at.id = :id`, { id })
      .getRawOne<AtendimentoListResponse>();

    const atendimentoServico = await this.manager.find(AtendimentosServicosEntity, {
      where: { atendimento_id: result.id },
      relations: ['service'],
    });
    result.atendimentosServicos = atendimentoServico;

    return result;
  }

  async findAtendimentos(): Promise<AtendimentoListResponse[]> {
    const query = this.queryAtendimento();
    const result = await query
      .getRawMany<AtendimentoListResponse>();

    for (const [k, at] of result.entries()) {
      const atendimentoServico = await this.manager.find(AtendimentosServicosEntity, {
        where: { atendimento_id: at.id },
        relations: ['service'],
      });
      result[k].atendimentosServicos = atendimentoServico;
    }

    return result;
  }

  async findAtendimentosByUserId(user_id: number): Promise<AtendimentoListResponse[]> {
    const query = this.queryAtendimento();
    const result = await query
      .where(`at.user_id = :user_id`, { user_id })
      .getRawMany<AtendimentoListResponse>();

    for (const [k, at] of result.entries()) {
      const atendimentoServico = await this.manager.find(AtendimentosServicosEntity, {
        where: { atendimento_id: at.id },
        relations: ['service'],
      });
      result[k].atendimentosServicos = atendimentoServico;
    }
    return result;
  }

  async ValidateAtendimento(
    client_id: number,
    user_id: number,
    contact_id: number,
    services: CreateAtendimentoServicoDto[],
  ) {
    let contacts: ContactsEntity;

    // verificando se foi informado o cliente
    if (!client_id) {
      this.logger.error('Erro ao validar: Cliente não informado');
      throw new BadRequestException('Cliente não informado');
    }

    // verificando se foi informado o usuário
    if (!user_id) {
      this.logger.error('Erro ao validar: Usuário não informado');
      throw new BadRequestException('Usuário não informado');
    }

    const clients = await this.queryRunner.manager.findOneBy(ClientsEntity, { id: client_id });
    if (!clients) {
      this.logger.error('Erro ao validar: Cliente informado não localizado');
      throw new NotFoundException('Cliente informado não localizado');
    }

    const users: UsersEntity = await this.queryRunner.manager.findOneBy(UsersEntity, { id: user_id });
    if (!users) {
      this.logger.error('Erro ao validar: Usuário informado não localizado');
      throw new NotFoundException('Usuário informado não localizado');
    }

    // verificando se foi informado o contato
    if (contact_id) {
      contacts = await this.queryRunner.manager.findOneBy(ContactsEntity, { id: contact_id });

      if (!contacts) {
        this.logger.error('Erro ao validar: Contato informado não localizado');
        throw new NotFoundException('Contato informado não localizado');
      }
    }
    if (services.length > 0) {
      let contErr = 0;
      services.forEach(async (v) => {
        const service = await this.queryRunner.manager.findOneBy(ServicesEntity, { id: v.service_id });
        if (!service) {
          contErr++;
          return;
        }
      });

      if (contErr > 0) {
        this.logger.error('Erro ao validar: Um dos serviços informado não localizado');
        throw new NotFoundException('Um dos serviços informado não localizado');
      }
    }

    return { clients, users, contacts };
  }

  queryAtendimento(): SelectQueryBuilder<AtendimentosEntity> {
    const query = this.createQueryBuilder('at')
      .innerJoinAndSelect('clients', 'cli', 'cli.id = at.client_id')
      .innerJoinAndSelect('users', 'u', 'u.id = at.user_id')
      .leftJoinAndSelect('contacts', 'cont', 'cont.id = at.contact_id')
      .innerJoinAndSelect('atendimento_status', 'as', 'as.id = at.atendimento_status_id')
      .select('at.*')
      .addSelect([
        'timediff(at.hora_fim, at.hora_inicio) as duration',
        'cli.nome as cli_nome',
        'cli.cnpj as cli_cnpj',
        'u.name as user_nome',
        'u.email as user_email',
        'cont.nome_contato as contact_nome',
        'cont.telefone_contato as contact_telefone',
        'as.descricao as status_descricao',
      ])
      .orderBy('at.id', 'DESC');

    return query;
  }
}
