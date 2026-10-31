import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DepartmentsController } from './departments.controller';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentsService } from './departments.service';
import { DepartmentSchedules } from './entities/department-schedules.entity';
import { Departments } from './entities/departments.entity';
import { UsersModule } from '@/users/users.module';
import { HolidaysModule } from '@/holidays/holidays.module';
import { DepartmentScheduleExceptions } from './entities/department-schedule-exceptions.entity';
import { DisponibilidadeSetorService } from './disponibilidade-setor.service';
import { ExcecoesHorarioService } from './excecoes-horario.service';

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
  imports: [TypeOrmModule.forFeature([Departments, DepartmentSchedules, DepartmentScheduleExceptions]), forwardRef(() => UsersModule), HolidaysModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService, DepartmentsRepository, DisponibilidadeSetorService, ExcecoesHorarioService],
  // O módulo de usuários usa o repository para resolver os ids ao gravar os
  // setores de um usuário.
  exports: [DepartmentsService, DepartmentsRepository, DisponibilidadeSetorService],
})
export class DepartmentsModule {}
