import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Not, QueryRunner } from 'typeorm';

import { CreateSupportDto } from './dto/create-support.dto';
import { CreateSupportServiceDto } from './dto/create-support-service.dto';

import { SupportListResponse } from '@types';
import { Supports } from './entities/supports.entity';
import { SupportServices } from './entities/support-services.entity';
import { Clients } from 'clients/entities/clients.entity';
import { Contacts } from 'contacts/entities/contacts.entity';
import { Users } from 'users/entities/users.entity';
import { Services } from 'service/entities/service.entity';
import { SupportStatus } from './entities/support-status.entity';
import { SupportRepository } from './supports.repository';
import { UpdateSupportDto } from './dto/update-support.dto';
import { runInTransaction } from '@/Utils';

@Injectable()
export class SupportsService {
  private queryRunner: QueryRunner;
  private readonly logger = new Logger(SupportsService.name);
  constructor(
    private supportsRepository: SupportRepository,
    private dataSource: DataSource,
  ) {
    this.queryRunner = dataSource.createQueryRunner();
  }

  async findOne(id: number): Promise<SupportListResponse> {
    const result = await this.supportsRepository.findSupport(id);
    return result;
  }

  async findByUserId(user_id: number) {
    return this.supportsRepository.findSupportsByUserId(user_id);
  }

  async findAll(): Promise<SupportListResponse[]> {
    const result = await this.supportsRepository.findSupports();

    return result;
  }

  async createSupport(createSupportDto: CreateSupportDto): Promise<Supports> {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { clients, users, contacts } = await this.ValidateSupport(
          createSupportDto.client_id,
          createSupportDto.user_id,
          createSupportDto.contact_id,
          createSupportDto.supportServices,
        );

        const newSupport = this.supportsRepository.create({
          data_referencia: createSupportDto.data_referencia,
          hora_inicio: createSupportDto.hora_inicio,
          hora_fim: createSupportDto.hora_fim,
          comentario: createSupportDto.comentario,
          tipo_entrada: createSupportDto.tipo_entrada,
          esta_pago: createSupportDto.esta_pago,
          support_status_id: createSupportDto.support_status_id,

          client: clients,
          contact: contacts,
          user: users,
        });

        await manager.save(Supports, newSupport);

        if (createSupportDto.supportServices.length > 0) {
          newSupport.supportServices = await this.SalvaSupportServico(
            newSupport,
            createSupportDto.supportServices,
          );
        }

        return newSupport;
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async updateSupport(
    atendimento_id: number,
    updateSupportDto: UpdateSupportDto,
  ): Promise<Supports> {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const atendimento = await this.supportsRepository.findOneBy({ id: atendimento_id });
        if (!atendimento) {
          this.logger.error(`Erro de atualizar atendimento: Support não localizado com este id`);
          throw new NotFoundException('Support não localizado com este id');
        }

        const { clients, users, contacts } = await this.ValidateSupport(
          updateSupportDto.client_id,
          updateSupportDto.user_id,
          updateSupportDto.contact_id,
          updateSupportDto.supportServices,
        );

        const updatedSupport = this.supportsRepository.create({
          ...atendimento,
          data_referencia: updateSupportDto.data_referencia,
          hora_inicio: updateSupportDto.hora_inicio,
          hora_fim: updateSupportDto.hora_fim,
          comentario: updateSupportDto.comentario,
          tipo_entrada: updateSupportDto.tipo_entrada,
          esta_pago: updateSupportDto.esta_pago,
          support_status_id: updateSupportDto.support_status_id,

          client: clients,
          contact: contacts,
          user: users,
        });

        await manager.save(Supports, updatedSupport);

        if (updateSupportDto.supportServices.length > 0) {
          updatedSupport.supportServices = await this.SalvaSupportServico(
            updatedSupport,
            updateSupportDto.supportServices,
          );
        }

        return updatedSupport;
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async deleteSupport(id: number) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const support = await this.supportsRepository.findSupport(id);
        if (!support) {
          this.logger.error(`Erro de atualizar atendimento: Support não localizado com este id`);
          throw new NotFoundException('Support não localizado com este id');
        }

        await manager.save(Supports, {
          ...support,
          support_status_id: 4,
        });
      } catch (err) {
        this.logger.error(err.message);
        throw new BadRequestException(err.message);
      }
    });
  }

  async getListStatus(): Promise<SupportStatus[]> {
    const status = await this.queryRunner.manager.findBy(SupportStatus, {
      id: Not(4),
    });
    return status;
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

  async SalvaSupportServico(
    support: Supports,
    servicos: CreateSupportServiceDto[],
  ): Promise<SupportServices[]> {
    await this.queryRunner.manager.delete(SupportServices, {
      support_id: support.id,
    });
    const servicosNew = servicos.map((servico) => ({
      ...servico,
      ...(servico.id !== undefined && { id: Number(servico.id) }),
      support_id: support.id,
    })) as SupportServices[];
    return this.queryRunner.manager.save(SupportServices, servicosNew);
  }

  async filterByDate(
    userId: number,
    dataInicio: string,
    dataFim: string,
  ): Promise<SupportListResponse[]> {
    const result = await this.supportsRepository.filterByDate(userId, dataInicio, dataFim);
    return result;
  }
}
