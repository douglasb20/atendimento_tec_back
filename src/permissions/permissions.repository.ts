import { DataSource, EntityManager, Repository } from 'typeorm';
import { Permissions } from './entities/permission.entity';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PermissionModule } from './entities/permission-module.entity';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionsRepository extends Repository<Permissions> {
  private readonly logger = new Logger(PermissionsRepository.name);
  constructor(private dataSource: DataSource) {
    super(Permissions, dataSource.manager);
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

  async findAllPermissions() {
    return this.find({
      relations: ['permissionModule']
    });
  }

  async findAllModules() {
    return this.dataSource.manager.find(PermissionModule);
  }

  async permissionByUser(user_id: number): Promise<Permissions[]> {
    const permissions = await this.createQueryBuilder('p')
      .innerJoinAndSelect('permission_x_user', 'pxu', 'pxu.permission_id = p.id')
      .select(['p.*'])
      .where('pxu.user_id = :user_id', { user_id })
      .getRawMany();
    return permissions;
  }

  async createPermission(createPermissionDto: CreatePermissionDto[], manager: EntityManager): Promise<void> {
    const permissions = this.create(createPermissionDto);
    await manager.save(permissions);
  }

  async updatePermission(id: number, updatePermissionDto: UpdatePermissionDto, manager: EntityManager) {
    const permission = await this.findOneBy({ id });
    if (!permission) {
      this.logger.error(`Erro de atualizar permissão: Permissão com id "${id}" nao encontrada`);
      throw new BadRequestException(`Permissão com id "${id}" nao encontrada`);
    }

    await manager.save(Permissions, {
      ...permission,
      ...updatePermissionDto,
    });
  }
}
