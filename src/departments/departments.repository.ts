import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { DepartmentSchedules } from './entities/department-schedules.entity';
import { Departments } from './entities/departments.entity';

/** Um setor com a quantidade de membros, para a listagem. */
export type SetorComMembros = Departments & { total_usuarios: number };

@Injectable()
export class DepartmentsRepository extends Repository<Departments> {
  constructor(protected dataSource: DataSource) {
    super(Departments, dataSource.manager);
  }

  /**
   * Os setores ativos, com quantos usuários ativos cada um tem.
   *
   * A contagem vem junto para a listagem mostrar o tamanho de cada setor sem
   * carregar os usuários inteiros.
   */
  async findAllActive(): Promise<SetorComMembros[]> {
    return this.createQueryBuilder('d')
      .loadRelationCountAndMap('d.total_usuarios', 'd.users', 'u', (qb) =>
        qb.where('u.status = 1'),
      )
      .where('d.deleted_at IS NULL')
      .orderBy('d.name', 'ASC')
      .getMany() as Promise<SetorComMembros[]>;
  }

  async findById(id: number, emitError = true): Promise<Departments> {
    const setor = await this.findOne({ where: { id, deleted_at: IsNull() } });

    if (!setor && emitError) {
      throw new NotFoundException('Setor não encontrado');
    }

    return setor;
  }

  /**
   * Resolve ids em entidades, ignorando os que não existem mais.
   *
   * Usado ao gravar os setores de um usuário: a tela pode enviar um setor
   * removido entre o carregamento e o salvamento, e derrubar a gravação inteira
   * por isso seria pior que ignorar o id órfão. Mesmo desenho de `tags`.
   */
  async findByIds(ids: number[], manager?: EntityManager): Promise<Departments[]> {
    if (!ids?.length) return [];

    const repo = manager ? manager.getRepository(Departments) : this;

    return repo.find({ where: { id: In(ids), deleted_at: IsNull() } });
  }

  /** Quantos usuários estão no setor - direto na tabela de ligação. */
  async contarUsuarios(departmentId: number, manager?: EntityManager): Promise<number> {
    const [{ total }] = await (manager ?? this.manager).query(
      'SELECT COUNT(*)::int AS total FROM user_x_department WHERE department_id = $1',
      [departmentId],
    );

    return total;
  }

  /**
   * Nome já usado por outro setor ativo.
   *
   * `lower()` nos dois lados, igual ao índice único do banco - sem isso
   * "Suporte" passaria pela validação e estouraria no INSERT.
   */
  async nomeEmUso(name: string, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('d')
      .where('lower(d.name) = lower(:name)', { name: name.trim() })
      .andWhere('d.deleted_at IS NULL');

    if (ignorarId) query.andWhere('d.id != :ignorarId', { ignorarId });

    return query.getExists();
  }

  /** Os intervalos de horário do setor, ordenados por dia e início. */
  async findSchedule(departmentId: number, manager?: EntityManager): Promise<DepartmentSchedules[]> {
    const repo = manager ? manager.getRepository(DepartmentSchedules) : this.manager.getRepository(DepartmentSchedules);

    return repo.find({
      where: { department_id: departmentId },
      order: { weekday: 'ASC', start_time: 'ASC' },
    });
  }

  /** Substitui todos os intervalos do setor de uma vez - "Salvar" sempre manda a lista inteira. */
  async substituiSchedule(
    departmentId: number,
    intervals: { weekday: number; start_time: string; end_time: string }[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(DepartmentSchedules);

    await repo.delete({ department_id: departmentId });

    if (intervals.length) {
      await repo.save(intervals.map((i) => repo.create({ ...i, department_id: departmentId })));
    }
  }
}
