import { DataSource, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { Supports } from './entities/supports.entity';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupportListResponse } from '@types';
import { SupportServices } from './entities/support-services.entity';
import { Clients } from 'clients/entities/clients.entity';
import { Contacts } from 'contacts/entities/contacts.entity';
import { Services } from 'service/entities/service.entity';
import { Users } from 'users/entities/users.entity';
import { CreateSupportServiceDto } from './dto/create-support-service.dto';

@Injectable()
export class SupportRepository extends Repository<Supports> {
  private readonly logger = new Logger(SupportRepository.name);
  constructor(protected dataSource: DataSource) {
    super(Supports, dataSource.manager);
  }

  async findSupport(id: number): Promise<SupportListResponse> {
    const query = this.querySupport();
    const result = await query
      .where(`at.id = :id`, { id })
      .andWhere({ support_status_id: Not(4) })
      .getRawOne<SupportListResponse>();

    const supportService = await this.manager.find(SupportServices, {
      where: { support_id: result.id },
      relations: ['service'],
    });
    result.supportServices = supportService;

    return result;
  }

  async findSupports(): Promise<SupportListResponse[]> {
    const query = this.querySupport();
    const result = await query
      .where({ support_status_id: Not(4) })
      .getRawMany<SupportListResponse>();

    for (const [k, at] of result.entries()) {
      const supportService = await this.manager.find(SupportServices, {
        where: { support_id: at.id },
        relations: ['service'],
      });
      result[k].supportServices = supportService;
    }

    return result;
  }

  async findSupportsByUserId(user_id: number): Promise<SupportListResponse[]> {
    const query = this.querySupport();
    const result = await query
      .where(`at.user_id = :user_id`, { user_id })
      .andWhere({ support_status_id: Not(4) })
      .getRawMany<SupportListResponse>();

    for (const [k, at] of result.entries()) {
      const supportServico = await this.manager.find(SupportServices, {
        where: { support_id: at.id },
        relations: ['service'],
      });
      result[k].supportServices = supportServico;
    }
    return result;
  }

  async filterByDate(
    userId: number,
    dataInicio: string,
    dataFim: string,
  ): Promise<SupportListResponse[]> {
    const query = this.querySupport();
    const result = await query
      .where(`at.data_referencia BETWEEN :dataInicio AND :dataFim`, { dataInicio, dataFim })
      .andWhere({ support_status_id: Not(4) })
      .andWhere(`at.user_id = :userId`, { userId })
      .getRawMany<SupportListResponse>();

    for (const [k, at] of result.entries()) {
      const supportServico = await this.manager.find(SupportServices, {
        where: { support_id: at.id },
        relations: ['service'],
      });
      result[k].supportServices = supportServico;
    }

    return result;
  }

  async ValidateSupport(
    client_id: number,
    user_id: number,
    contact_id: number,
    services: CreateSupportServiceDto[],
  ) {
    let contacts: Contacts;

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

    const clients = await this.queryRunner.manager.findOneBy(Clients, { id: client_id });
    if (!clients) {
      this.logger.error('Erro ao validar: Cliente informado não localizado');
      throw new NotFoundException('Cliente informado não localizado');
    }

    const users: Users = await this.queryRunner.manager.findOneBy(Users, {
      id: user_id,
    });
    if (!users) {
      this.logger.error('Erro ao validar: Usuário informado não localizado');
      throw new NotFoundException('Usuário informado não localizado');
    }

    // verificando se foi informado o contato
    if (contact_id) {
      contacts = await this.queryRunner.manager.findOneBy(Contacts, { id: contact_id });

      if (!contacts) {
        this.logger.error('Erro ao validar: Contato informado não localizado');
        throw new NotFoundException('Contato informado não localizado');
      }
    }
    if (services.length > 0) {
      let contErr = 0;
      services.forEach(async (v) => {
        const service = await this.queryRunner.manager.findOneBy(Services, {
          id: v.service_id,
        });
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

  querySupport(): SelectQueryBuilder<Supports> {
    const query = this.createQueryBuilder('at')
      .innerJoinAndSelect('clients', 'cli', 'cli.id = at.client_id')
      .innerJoinAndSelect('users', 'u', 'u.id = at.user_id')
      .leftJoinAndSelect('contacts', 'cont', 'cont.id = at.contact_id')
      .innerJoinAndSelect('support_status', 'as', 'as.id = at.support_status_id')
      .select([
        'at.*',
        'timediff(at.hora_fim, at.hora_inicio) as duration',
        'cli.nome as cli_nome',
        'cli.cnpj as cli_cnpj',
        'u.name as user_nome',
        'u.email as user_email',
        'cont.name as contact_nome',
        'cont.phone as contact_phone',
        'as.descricao as status_descricao',
      ])
      .addSelect(
        `
          CASE
            WHEN at.tipo_entrada = "T" THEN (TIME_TO_SEC(TIMEDIFF(at.hora_fim, at.hora_inicio)) / 3600) * u.valor_hora
            ELSE (SELECT SUM(ss.service_fee) FROM support_services as ss WHERE ss.support_id=at.id)
          END AS total_amount
        `,
      )
      .orderBy('at.id', 'DESC');

    return query;
  }
}
