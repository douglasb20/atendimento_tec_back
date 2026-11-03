import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { partesDataAtendimento } from '@/core/data-atendimento';
import { HolidaysRepository } from '@/holidays/holidays.repository';
import { DepartmentsRepository } from './departments.repository';
import { IntervaloExcecao, ModoExcecao } from './entities/department-schedule-exceptions.entity';
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
    const [excecoes, semana] = await Promise.all([
      this.banco.query(`SELECT mode, intervals FROM department_schedule_exceptions
        WHERE department_id = $1 AND (
          (recurring = false AND date = $2::date) OR
          (recurring = true AND EXTRACT(MONTH FROM date) = $3 AND EXTRACT(DAY FROM date) = $4)
        ) ORDER BY recurring ASC LIMIT 1`, [setorId, data.data, data.mes, data.dia]),
      this.setores.findSchedule(setorId),
    ]);
    // false vem antes de true: a decisão específica daquele ano supera a anual.
    const excecao = excecoes[0] as { mode: ModoExcecao; intervals: IntervaloExcecao[] } | undefined;
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
