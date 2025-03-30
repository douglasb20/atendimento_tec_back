import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { DataSource, QueryRunner } from 'typeorm';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { PermissionsEntity } from './entities/permission.entity';

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

      const permissions = this.permissionRepository.create(createPermissionDto);
      await this.queryRunner.manager.save(permissions);
      
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
      const permission = await this.permissionRepository.findOneBy({ id });
      if (!permission) { 
        this.logger.error(`Erro de atualizar permissão: Permissão com id "${id}" nao encontrada`); 
        throw new BadRequestException(`Permissão com id "${id}" nao encontrada`); 
      }

      await this.queryRunner.manager.save(PermissionsEntity, {
        ...permission,
        ...updatePermissionDto,
      });
      
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

  async createModule() {
    
  }

  async updateModule() {
    
  }
  
}
