import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { Permissions } from '@/permissions/entities/permission.entity';
import { Users } from '@/users/entities/users.entity';
import { PermissionGroups } from './entities/permission-groups.entity';

@Injectable()
export class PermissionGroupsRepository extends Repository<PermissionGroups> {
  constructor(protected dataSource: DataSource) {
    super(PermissionGroups, dataSource.manager);
  }

  async findAllActive(): Promise<PermissionGroups[]> {
    return this.find({
      where: { deleted_at: IsNull() },
      relations: ['permissions'],
      order: { name: 'ASC' },
    });
  }

  async findById(id: number, emitError = true, manager?: EntityManager): Promise<PermissionGroups> {
    const repo = manager ? manager.getRepository(PermissionGroups) : this;

    const grupo = await repo.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['permissions'],
    });

    if (!grupo && emitError) {
      throw new NotFoundException('Grupo de permissão não encontrado');
    }

    return grupo;
  }

  /** Nome já usado por outro grupo ativo? A comparação ignora maiúsculas. */
  async nomeEmUso(name: string, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('r')
      .where('lower(r.name) = lower(:name)', { name })
      .andWhere('r.deleted_at IS NULL');

    if (ignorarId) {
      query.andWhere('r.id != :ignorarId', { ignorarId });
    }

    return query.getExists();
  }

  /** Quantos usuários usam este grupo — verificado antes de remover. */
  async contarUsuariosVinculados(id: number): Promise<number> {
    return this.manager.count(Users, { where: { permission_group_id: id } });
  }

  /**
   * Resolve ids em entidades, ignorando os que não existem.
   *
   * Mesmo critério de `TagsRepository.findByIds`: a tela pode enviar um id
   * removido entre o carregamento e o salvamento, e derrubar a gravação inteira
   * por isso seria pior que ignorar o órfão.
   */
  async permissoesPorIds(ids: number[], manager?: EntityManager): Promise<Permissions[]> {
    if (!ids?.length) return [];

    const repo = manager ? manager.getRepository(Permissions) : this.manager.getRepository(Permissions);

    return repo.find({ where: { id: In(ids) } });
  }

  /** Ids dos usuários com este grupo — usados para invalidar o cache. */
  async idsDosUsuarios(permission_group_id: number): Promise<number[]> {
    const usuarios = await this.manager.find(Users, {
      where: { permission_group_id },
      select: { id: true },
    });

    return usuarios.map((u) => u.id);
  }

  async softDelete_(id: number, manager: EntityManager): Promise<void> {
    await manager.update(PermissionGroups, id, { deleted_at: new Date() });
  }
}
