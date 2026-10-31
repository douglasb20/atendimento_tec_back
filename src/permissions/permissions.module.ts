import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Permissions } from './entities/permission.entity';
import { PermissionGuard } from './permissions.guard'; // Importa o PermissionGuard
import { PermissionsRepository } from './permissions.repository'; // Ajuste conforme necessário
import { PermissionXUser } from './entities/permission-x-user.entity';
import { PermissionService } from './permission.service';
import { PermissionsController } from './permissions.controller';
import { PermissionModule } from './entities/permission-module.entity';
import { AcessoAtendimentoService } from './acesso-atendimento.service';
import { AcessoAtendimentoGuard } from './acesso-atendimento.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Permissions, PermissionXUser, PermissionModule])],
  providers: [PermissionGuard, PermissionsRepository, PermissionService, AcessoAtendimentoService, AcessoAtendimentoGuard],
  exports: [PermissionService, AcessoAtendimentoService, AcessoAtendimentoGuard],
  controllers: [PermissionsController],
})
export class PermissionsModule {}
