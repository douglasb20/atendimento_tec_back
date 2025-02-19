import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { AtendimentoListResponse } from 'interface';

import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { CreateAtendimentoServicoDto } from './dto/create-atendimento-servico.dto';

import { Atendimentos } from './entities/atendimento-entity';
import { AtendimentosServicos } from './entities/atendimento-servico-entity';
import { Clients } from 'client/entities/clients.entity';
import { Contacts } from 'client/entities/contacts.entity';
import { Users } from 'users/entities/users.entity';
import { Services } from 'service/entities/service.entity';
import { AtendimentoStatus } from './entities/atendimento-status-entity';

@Injectable()
export class AtendimentosService {
  private queryRunner: QueryRunner;
  private readonly logger = new Logger(AtendimentosService.name);
  constructor(
    @InjectRepository(Atendimentos)
    private atendimentoRepository: Repository<Atendimentos>,
    private dataSource: DataSource,
  ) {
    this.queryRunner = this.dataSource.createQueryRunner();
  }

  async findOne(id: number) {
    const result = await this.atendimentoRepository
      .createQueryBuilder('at')
      .innerJoinAndSelect('clients', 'cli', 'cli.id = at.clients_id')
      .innerJoinAndSelect('users', 'u', 'u.id = at.users_id')
      .leftJoinAndSelect('contacts', 'cont', 'cont.id = at.contacts_id')
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
      .where(`at.id = :id`, { id: id })
      .getRawOne<AtendimentoListResponse>();

    const atendimentoServico = await this.queryRunner.manager.find(AtendimentosServicos, {
      where: { id_atendimento: result.id },
      relations: ['service'],
    });
    result.atendimentosServicos = atendimentoServico;
    // return await this.atendimentoRepository.find({
    //   relations: ['atendimento_status', 'users', 'clients', 'contacts'],
    // })
    return result;
  }

  async findAll() {
    const result = await this.atendimentoRepository
      .createQueryBuilder('at')
      .innerJoinAndSelect('clients', 'cli', 'cli.id = at.clients_id')
      .innerJoinAndSelect('users', 'u', 'u.id = at.users_id')
      .leftJoinAndSelect('contacts', 'cont', 'cont.id = at.contacts_id')
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
      .orderBy('at.id', 'DESC')
      .getRawMany<AtendimentoListResponse>();

    for (const [k, at] of result.entries()) {
      const atendimentoServico = await this.queryRunner.manager.find(AtendimentosServicos, {
        where: { id_atendimento: at.id },
        relations: ['service'],
      });
      result[k].atendimentosServicos = atendimentoServico;
    }

    return result;
  }

  async createAtendimento(createAtendimentoDto: CreateAtendimentoDto) {
    try {
      await this.queryRunner.startTransaction('READ COMMITTED');

      const { clients, users, contacts } = await this.ValidateAtendimento(
        createAtendimentoDto.clients_id,
        createAtendimentoDto.users_id,
        createAtendimentoDto.contacts_id,
        createAtendimentoDto.atendimentosServicos,
      );

      const newAtendimento = this.atendimentoRepository.create({
        data_referencia: createAtendimentoDto.data_referencia,
        hora_inicio: createAtendimentoDto.hora_inicio,
        hora_fim: createAtendimentoDto.hora_fim,
        comentario: createAtendimentoDto.comentario,
        tipo_entrada: createAtendimentoDto.tipo_entrada,
        esta_pago: createAtendimentoDto.esta_pago,
        atendimento_status_id: createAtendimentoDto.atendimento_status_id,

        clients: clients,
        contacts: contacts,
        users: users,
      });

      await this.atendimentoRepository.save(newAtendimento);

      if (createAtendimentoDto.atendimentosServicos.length > 0) {
        newAtendimento.atendimentosServicos = await this.SalvaAtendimentoServico(
          newAtendimento,
          createAtendimentoDto.atendimentosServicos,
        );
      }

      await this.queryRunner.commitTransaction();
      return newAtendimento;
    } catch (err) {
      await this.queryRunner.rollbackTransaction();
      throw err;
    }
  }

  async getListStatus() {
    const status = await this.queryRunner.manager.find(AtendimentoStatus);
    return status;
  }

  async ValidateAtendimento(
    clients_id: number,
    users_id: number,
    contacts_id: number,
    services: CreateAtendimentoServicoDto[],
  ) {
    let contacts: Contacts;

    // verificando se foi informado o cliente
    if (!clients_id) {
      this.logger.error('Erro ao validar: Cliente não informado');
      throw new BadRequestException('Cliente não informado');
    }

    // verificando se foi informado o usuário
    if (!users_id) {
      this.logger.error('Erro ao validar: Usuário não informado');
      throw new BadRequestException('Usuário não informado');
    }

    const clients = await this.queryRunner.manager.findOneBy(Clients, { id: clients_id });
    if (!clients) {
      this.logger.error('Erro ao validar: Cliente informado não localizado');
      throw new NotFoundException('Cliente informado não localizado');
    }

    const users: Users = await this.queryRunner.manager.findOneBy(Users, { id: users_id });
    if (!users) {
      this.logger.error('Erro ao validar: Usuário informado não localizado');
      throw new NotFoundException('Usuário informado não localizado');
    }

    // verificando se foi informado o contato
    if (contacts_id) {
      contacts = await this.queryRunner.manager.findOneBy(Contacts, { id: contacts_id });

      if (!contacts) {
        this.logger.error('Erro ao validar: Contato informado não localizado');
        throw new NotFoundException('Contato informado não localizado');
      }
    }
    if (services.length > 0) {
      let contErr = 0;
      services.forEach(async (v) => {
        const service = await this.queryRunner.manager.findOneBy(Services, { id: v.id_service });
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

  async SalvaAtendimentoServico(
    atendimento: Atendimentos,
    servicos: CreateAtendimentoServicoDto[],
  ) {
    const servicosNew = servicos.map((servico) => ({
      ...servico,
      ...(servico.id !== undefined && { id: Number(servico.id) }),
      id_atendimento: atendimento.id,
    })) as AtendimentosServicos[];
    return this.queryRunner.manager.save(AtendimentosServicos, servicosNew);
  }
}
