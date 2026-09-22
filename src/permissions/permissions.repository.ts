import { DataSource, Repository } from 'typeorm';
import { Permissions } from './entities/permission.entity';
import { Injectable } from '@nestjs/common';
import { PermissionModule } from './entities/permission-module.entity';

@Injectable()
export class PermissionsRepository extends Repository<Permissions> {
  constructor(private dataSource: DataSource) {
    super(Permissions, dataSource.manager);
  }

  /**
   * O usuário tem ao menos uma das permissões? (semântica OU)
   *
   * O caminho é `users → permission_groups → permission_group_x_permission → permissions`. A tabela
   * `permission_x_user` não entra: desde a adoção dos grupos ela está vazia, e
   * fica reservada para as exceções individuais.
   */
  async hasPermission(user_id: number, permissionName: string[]): Promise<boolean> {
    if (!permissionName?.length) return false;

    return this.createQueryBuilder('p')
      .innerJoin('permission_group_x_permission', 'pgxp', 'pgxp.permission_id = p.id')
      .innerJoin('users', 'u', 'u.permission_group_id = pgxp.permission_group_id')
      .where('p.name IN (:...permissionName)', { permissionName })
      .andWhere('u.id = :userId', { userId: user_id })
      .getExists();
  }

  /** Os nomes das permissões do usuário, pelo grupo. */
  async nomesPermissoesDoUsuario(user_id: number): Promise<string[]> {
    const linhas = await this.createQueryBuilder('p')
      .select('p.name', 'name')
      .innerJoin('permission_group_x_permission', 'pgxp', 'pgxp.permission_id = p.id')
      .innerJoin('users', 'u', 'u.permission_group_id = pgxp.permission_group_id')
      .where('u.id = :userId', { userId: user_id })
      .getRawMany<{ name: string }>();

    return linhas.map((l) => l.name);
  }

  async findAllPermissions() {
    return this.find({
      relations: ['permissionModule'],
    });
  }

  async findAllModules() {
    return this.dataSource.manager.find(PermissionModule);
  }

  /**
   * As permissões do usuário, para `/users/info` alimentar a interface.
   *
   * Lê pelo grupo, como o guard. Antes lia `permission_x_user`, que hoje está
   * vazia - a tela mostraria "sem acesso" para todo mundo.
   */
  async permissionByUser(user_id: number): Promise<Permissions[]> {
    return this.createQueryBuilder('p')
      .select(['p.*'])
      .innerJoin('permission_group_x_permission', 'pgxp', 'pgxp.permission_id = p.id')
      .innerJoin('users', 'u', 'u.permission_group_id = pgxp.permission_group_id')
      .where('u.id = :user_id', { user_id })
      .getRawMany();
  }
}
