import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'auth/auth.module';
import { PermissionGroups } from './entities/permission-groups.entity';
import { PermissionGroupsController } from './permission-groups.controller';
import { PermissionGroupsRepository } from './permission-groups.repository';
import { PermissionGroupsService } from './permission-groups.service';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionGroups]), AuthModule],
  controllers: [PermissionGroupsController],
  providers: [PermissionGroupsService, PermissionGroupsRepository],
  exports: [PermissionGroupsService, PermissionGroupsRepository],
})
export class PermissionGroupsModule {}
