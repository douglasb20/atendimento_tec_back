import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HolidaysRepository } from '@/holidays/holidays.repository';
import { DepartmentsRepository } from './departments.repository';
import { DepartmentScheduleExceptions } from './entities/department-schedule-exceptions.entity';
import { SalvarExcecaoHorarioDto } from './dto/salvar-excecao-horario.dto';
import { validarIntervalosExcecao } from './intervalos-excecao';

@Injectable()
export class ExcecoesHorarioService {
  constructor(private readonly banco: DataSource, private readonly setores: DepartmentsRepository,
    private readonly feriados: HolidaysRepository) {}

  async listar(setorId: number) {
    await this.setores.findById(setorId);
    return this.banco.getRepository(DepartmentScheduleExceptions).find({
      where: { department_id: setorId }, order: { date: 'ASC' },
    });
  }

  async salvar(setorId: number, dto: SalvarExcecaoHorarioDto, id?: number) {
    await this.setores.findById(setorId);
    const repo = this.banco.getRepository(DepartmentScheduleExceptions);
    if (id && !await repo.existsBy({ id, department_id: setorId })) throw new NotFoundException('Exceção não encontrada neste setor');
    const descricao = dto.description.trim();
    if (!descricao) throw new BadRequestException('Informe a descrição da exceção');
    let intervalos;
    try { intervalos = validarIntervalosExcecao(dto.mode, dto.intervals); }
    catch (erro) { throw new BadRequestException(erro.message); }
    if (dto.holiday_id) {
      const feriado = await this.feriados.findById(dto.holiday_id);
      if (dto.recurring && !feriado.recurring) {
        throw new BadRequestException('Um feriado de ano específico não pode gerar uma exceção que se repete todos os anos');
      }
      const [ano, mes, dia] = dto.date.split('-').map(Number);
      if (feriado.month !== mes || feriado.day !== dia || !feriado.recurring && feriado.year !== ano) {
        throw new BadRequestException('A data não corresponde ao feriado selecionado');
      }
    }
    try {
      const dados = { department_id: setorId, date: dto.recurring ? `2000-${dto.date.slice(5)}` : dto.date,
        recurring: dto.recurring ?? false, description: descricao,
        mode: dto.mode, intervals: intervalos, holiday_id: dto.holiday_id ?? null };
      if (id) {
        const alteracao = await repo.update({ id, department_id: setorId }, dados);
        if (!alteracao.affected) throw new NotFoundException('Exceção não encontrada neste setor');
        return repo.findOneBy({ id, department_id: setorId });
      }
      return await repo.save(repo.create(dados));
    } catch (erro) {
      if (erro.code === '23505') throw new ConflictException(dto.recurring
        ? 'Já existe uma exceção anual para este dia e mês neste setor'
        : 'Já existe uma exceção para esta data neste setor');
      throw erro;
    }
  }

  async remover(setorId: number, id: number): Promise<void> {
    await this.setores.findById(setorId);
    const resultado = await this.banco.getRepository(DepartmentScheduleExceptions).delete({ id, department_id: setorId });
    if (!resultado.affected) throw new NotFoundException('Exceção não encontrada neste setor');
  }
}
