import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { CreateAtendimentoServicoDto } from './dto/create-atendimento-servico.dto';

import { AtendimentosEntity } from './entities/atendimento.entity';
import { AtendimentosServicosEntity } from './entities/atendimento-servico.entity';
import { ClientsEntity } from 'client/entities/clients.entity';
import { ContactsEntity } from 'client/entities/contacts.entity';
import { UsersEntity } from 'users/entities/users.entity';
import { ServicesEntity } from 'service/entities/service.entity';
import { AtendimentoStatusEntity } from './entities/atendimento-status.entity';
import { AtendimentoRepository } from './atendimentos.repository';

@Injectable()
export class AtendimentosService {
  private queryRunner: QueryRunner;
  private readonly logger = new Logger(AtendimentosService.name);
  constructor(
    private atendimentoRepository: AtendimentoRepository,
    private dataSource: DataSource,
  ) {
    this.queryRunner = this.dataSource.createQueryRunner();
  }

  async findOne(id: number) {
    const result = await this.atendimentoRepository.findAtendimento(id);

    // return await this.atendimentoRepository.find({
    //   relations: ['atendimento_status', 'users', 'clients', 'contacts'],
    // })
    return result;
  }

  async findAll() {
    const result = await this.atendimentoRepository.findAtendimentos();

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
    const status = await this.queryRunner.manager.find(AtendimentoStatusEntity);
    return status;
  }

  async ValidateAtendimento(
    clients_id: number,
    users_id: number,
    contacts_id: number,
    services: CreateAtendimentoServicoDto[],
  ) {
    let contacts: ContactsEntity;

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

    const clients = await this.queryRunner.manager.findOneBy(ClientsEntity, { id: clients_id });
    if (!clients) {
      this.logger.error('Erro ao validar: Cliente informado não localizado');
      throw new NotFoundException('Cliente informado não localizado');
    }

    const users: UsersEntity = await this.queryRunner.manager.findOneBy(UsersEntity, { id: users_id });
    if (!users) {
      this.logger.error('Erro ao validar: Usuário informado não localizado');
      throw new NotFoundException('Usuário informado não localizado');
    }

    // verificando se foi informado o contato
    if (contacts_id) {
      contacts = await this.queryRunner.manager.findOneBy(ContactsEntity, { id: contacts_id });

      if (!contacts) {
        this.logger.error('Erro ao validar: Contato informado não localizado');
        throw new NotFoundException('Contato informado não localizado');
      }
    }
    if (services.length > 0) {
      let contErr = 0;
      services.forEach(async (v) => {
        const service = await this.queryRunner.manager.findOneBy(ServicesEntity, { id: v.id_service });
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
    atendimento: AtendimentosEntity,
    servicos: CreateAtendimentoServicoDto[],
  ) {
    const servicosNew = servicos.map((servico) => ({
      ...servico,
      ...(servico.id !== undefined && { id: Number(servico.id) }),
      id_atendimento: atendimento.id,
    })) as AtendimentosServicosEntity[];
    return this.queryRunner.manager.save(AtendimentosServicosEntity, servicosNew);
  }
}
