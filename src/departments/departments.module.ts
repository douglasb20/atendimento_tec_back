import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DepartmentsController } from './departments.controller';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsService } from './departments.service';
import { DepartmentSchedules } from './entities/department-schedules.entity';
import { Departments } from './entities/departments.entity';
import { UsersModule } from '@/users/users.module';

/**
 * Setores de atendimento.
 *
 * ⚠️ O `forFeature` é obrigatório mesmo com `autoLoadEntities`: sem ele o boot
 * passa e a primeira consulta quebra.
 *
 * `forwardRef` nos dois lados com `UsersModule`: este precisa do
 * `UserRepository` para montar a aba de membros do setor, e aquele precisa
 * deste para resolver os `department_ids` ao gravar um usuário.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Departments, DepartmentSchedules]), forwardRef(() => UsersModule)],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository],
  // O módulo de usuários usa o repository para resolver os ids ao gravar os
  // setores de um usuário.
  exports: [DepartmentsService, DepartmentsRepository],
})
export class DepartmentsModule {}
