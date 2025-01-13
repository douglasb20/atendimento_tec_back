import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';

import { CreateAtendimentoDto } from './dto/create-atendimento.dto';

import { Atendimentos } from './entities/atendimento-entity';
import { Clients } from 'client/entities/clients.entity';
import { Contacts } from 'client/entities/contacts.entity';
import { Users } from 'users/entities/users.entity';



@Injectable()
export class AtendimentosService {
  private queryRunner: QueryRunner;
  constructor(
    @InjectRepository(Atendimentos)
    private atendimentoRepository: Repository<Atendimentos>,
    private dataSource: DataSource,
  ) {
    this.queryRunner = this.dataSource.createQueryRunner();
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
      .getRawMany();
    // return await this.atendimentoRepository.find({
    //   relations: ['atendimento_status', 'users', 'clients', 'contacts'],
    // })
    return result;
  }

  async createAtendimento(createAtendimentoDto: CreateAtendimentoDto) {
    try {
      await this.queryRunner.startTransaction();

      const { clients, users, contacts } = await this.ValidateAtendimento(
        createAtendimentoDto.clients_id,
        createAtendimentoDto.users_id,
        createAtendimentoDto.contacts_id
      );

      const newAtendimento = this.atendimentoRepository.create({
        data_referencia: createAtendimentoDto.data_referencia,
        hora_inicio: createAtendimentoDto.hora_inicio,
        hora_fim: createAtendimentoDto.hora_fim,
        comentario: createAtendimentoDto.comentario, // cSpell:disable-line
        tipo_entrada: createAtendimentoDto.tipo_entrada,
        esta_pago: createAtendimentoDto.esta_pago,
        atendimento_status_id: createAtendimentoDto.atendimento_status_id,

        // teste para git
        clients: clients,
        contacts: contacts,
        users: users,
      });

      await this.atendimentoRepository.save(newAtendimento);

      await this.queryRunner.commitTransaction();
    } catch (err) {
      await this.queryRunner.rollbackTransaction();
      throw err;
    }
  }

  async ValidateAtendimento(clients_id: number, users_id: number, contacts_id: number) {
    let contacts: Contacts;
    
    // verificando se foi informado o cliente
    if (!clients_id) {
      throw new BadRequestException("Cliente não informado");
    }

    // verificando se foi informado o usuário
    if (!users_id) {
      throw new BadRequestException("Usuário não informado");
    }

    const clients = await this.queryRunner.manager.findOneBy(Clients, { id: clients_id });
    if (!clients) {
      throw new NotFoundException("Cliente informado não localizado");
    }

    const users: Users = await this.queryRunner.manager.findOneBy(Users, { id: users_id })
    if (!users) {
      throw new NotFoundException("Usuário informado não localizado");
    }

    // verificando se foi informado o contato
    if (contacts_id) {
      contacts = await this.queryRunner.manager.findOneBy(Contacts, { id: contacts_id })

      if (!contacts) {
        throw new NotFoundException("Contato informado não localizado");
      }
    }

    return { clients, users, contacts }
  }
}
