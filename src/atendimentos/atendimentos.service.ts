import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Atendimentos } from './entities/atendimento-entity';

@Injectable()
export class AtendimentosService {
  private queryRunner: QueryRunner;
  constructor(
    @InjectRepository(Atendimentos)
    private atendimentoRepository: Repository<Atendimentos>,
    private dataSource: DataSource
  ) { 
    this.queryRunner = this.dataSource.createQueryRunner();
  }
  
  async findAll() {
    const result = await this.atendimentoRepository.createQueryBuilder('at')
    .innerJoinAndSelect('clients', 'cli', 'cli.id = at.clients_id')
    .innerJoinAndSelect('users', 'u', 'u.id = at.users_id')
    .innerJoinAndSelect('contacts', 'cont', 'cont.id = at.contacts_id')
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
}
