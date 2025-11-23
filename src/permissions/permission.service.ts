import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

import { PermissionsRepository } from './permissions.repository';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionService {
  private queryRunner: QueryRunner;
  private readonly logger = new Logger(PermissionService.name);
  constructor(
    private readonly permissionRepository: PermissionsRepository,
    private dataSource: DataSource,
  ) {
    this.queryRunner = this.dataSource.createQueryRunner();
  }

  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const permissionRecord = await this.permissionRepository.hasPermission(userId, permission);

    return permissionRecord;
  }

  async findAll() {
    return this.permissionRepository.findAllPermissions();
  }

  async permissionByUser(user_id: number) {
    return this.permissionRepository.permissionByUser(user_id);
  }

  async createPermission(createPermissionDto: CreatePermissionDto[]) {
    try {
      await this.queryRunner.startTransaction();

      await this.permissionRepository.createPermission(
        createPermissionDto,
        this.queryRunner.manager,
      );

      await this.queryRunner.commitTransaction();
    } catch (err) {
      await this.queryRunner.rollbackTransaction();
      this.logger.error(err.message);
      throw new BadRequestException(err.message);
    }
  }

  async updatePermission(id: number, updatePermissionDto: UpdatePermissionDto) {
    try {
      await this.queryRunner.startTransaction();

      await this.permissionRepository.updatePermission(
        id,
        updatePermissionDto,
        this.queryRunner.manager,
      );

      await this.queryRunner.commitTransaction();
    } catch (err) {
      await this.queryRunner.rollbackTransaction();
      this.logger.error(err.message);
      throw new BadRequestException(err.message);
    }
  }

  // =============== Modules =============

  async findAllModules() {
    return this.permissionRepository.findAllModules();
  }

  async createModule() {}

  async updateModule() {}
}
