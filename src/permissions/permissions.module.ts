import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionsEntity } from './entities/permission.entity';
import { PermissionGuard } from './permissions.guard'; // Importa o PermissionGuard
import { PermissionsRepository } from './permissions.repository'; // Ajuste conforme necessário
import { PermissionXUserEntity } from './entities/permission-x-user.entity';
import { PermissionService } from './permission.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        PermissionsEntity,
        PermissionXUserEntity
      ]
    )
  ],
  providers: [
    PermissionGuard,
    PermissionsRepository,
    PermissionService
  ],
  exports: [PermissionService], 
})
export class PermissionModule {}
