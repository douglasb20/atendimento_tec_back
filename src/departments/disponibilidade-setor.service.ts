import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { partesDataAtendimento } from '@/core/data-atendimento';
import { HolidaysRepository } from '@/holidays/holidays.repository';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentScheduleExceptions } from './entities/department-schedule-exceptions.entity';
import { avaliarDisponibilidadeSetor } from './disponibilidade-setor';

@Injectable()
export class DisponibilidadeSetorService {
  constructor(
    private readonly setores: DepartmentsRepository,
    private readonly feriados: HolidaysRepository,
    private readonly banco: DataSource,
  ) {}

  async verificar(setorId: number, agora = new Date()) {
    const setor = await this.setores.findById(setorId);
    if (!setor.schedule_enabled) return { disponivel: true, mensagemAusencia: setor.absence_message };
    const data = partesDataAtendimento(agora);
    const [excecao, semana] = await Promise.all([
      this.banco.getRepository(DepartmentScheduleExceptions).findOneBy({ department_id: setorId, date: data.data }),
      this.setores.findSchedule(setorId),
    ]);
    const feriado = !excecao && setor.respect_holidays
      ? await this.feriados.existeEm(data.mes, data.dia, data.ano) : false;
    return {
      disponivel: avaliarDisponibilidadeSetor({
        ativo: true, respeitarFeriados: setor.respect_holidays,
        feriado, diaSemana: data.diaSemana, hora: data.hora, semana, excecao,
      }),
      mensagemAusencia: setor.absence_message,
    };
  }
}
