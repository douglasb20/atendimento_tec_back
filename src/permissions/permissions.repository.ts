import { DataSource, Repository } from 'typeorm';
import { PermissionsEntity } from './entities/permission.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PermissionsRepository extends Repository<PermissionsEntity> {
  constructor(dataSource: DataSource) {
    super(PermissionsEntity, dataSource.manager);
  }
  async hasPermission(user_id: number, permissionName: string): Promise<boolean> {
    const permission = await this.createQueryBuilder('p')
      .innerJoinAndSelect('permission_x_user', 'pxu', 'pxu.permission_id = p.id')
      .select('p.*')
      .where('p.name = :permissionName', { permissionName })
      .andWhere('pxu.user_id = :userId', { userId: user_id })
      .getExists();

    return permission;
  }
}