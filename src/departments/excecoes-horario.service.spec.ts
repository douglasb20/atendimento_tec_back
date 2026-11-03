import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ExcecoesHorarioService } from './excecoes-horario.service';
import { SalvarExcecaoHorarioDto } from './dto/salvar-excecao-horario.dto';

jest.mock('@/holidays/holidays.repository', () => ({ HolidaysRepository: class {} }));
jest.mock('./departments.repository', () => ({ DepartmentsRepository: class {} }));
jest.mock('./entities/department-schedule-exceptions.entity', () => ({ DepartmentScheduleExceptions: class {} }));

describe('Exceções pontuais e anuais por setor', () => {
  const dto = (patch: Partial<SalvarExcecaoHorarioDto> = {}): SalvarExcecaoHorarioDto => ({
    date: '2026-11-02', description: 'Plantão de Finados', mode: 'especial',
    intervals: [{ start_time: '08:00', end_time: '12:00' }], ...patch,
  });
  function preparar() {
    const repo = { create: jest.fn(dados => dados), save: jest.fn(async dados => ({ id: 1, ...dados })),
      existsBy: jest.fn().mockResolvedValue(true), update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOneBy: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    const feriados = { findById: jest.fn().mockResolvedValue({ recurring: true, month: 11, day: 2, year: null }) };
    const servico = new ExcecoesHorarioService({ getRepository: () => repo } as never,
      { findById: jest.fn() } as never, feriados as never);
    return { servico, repo, feriados };
  }
  it('mantém a data completa e não repete sem opção explícita', async () => {
    const { servico, repo } = preparar();
    await servico.salvar(10, dto());
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-02', recurring: false }));
  });
  it.each(['2026-11-02', '2027-11-02'])('normaliza a mesma regra anual de %s sem depender do ano', async date => {
    const { servico, repo } = preparar();
    await servico.salvar(10, dto({ date, recurring: true }));
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ date: '2000-11-02', recurring: true }));
  });
  it('preserva 29/02 na referência bissexta sem deslocar para março', async () => {
    const { servico, repo } = preparar();
    await servico.salvar(10, dto({ date: '2028-02-29', recurring: true }));
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ date: '2000-02-29' }));
  });
  it('um feriado fixo aceita regra anual e uma exceção pontual', async () => {
    const { servico } = preparar();
    await expect(servico.salvar(10, dto({ holiday_id: 1, recurring: true }))).resolves.toBeDefined();
    await expect(servico.salvar(10, dto({ holiday_id: 1, recurring: false }))).resolves.toBeDefined();
  });
  it('não transforma um feriado de ano específico em regra anual', async () => {
    const { servico, feriados } = preparar();
    feriados.findById.mockResolvedValue({ recurring: false, month: 11, day: 2, year: 2026 });
    await expect(servico.salvar(10, dto({ holiday_id: 1, recurring: true }))).rejects.toThrow('ano específico');
  });
  it('mantém a validação do dia e mês do feriado vinculado', async () => {
    const { servico } = preparar();
    await expect(servico.salvar(10, dto({ holiday_id: 1, date: '2026-11-03', recurring: true }))).rejects.toThrow('não corresponde');
  });
  it('distingue erro de duplicidade anual do pontual', async () => {
    const { servico, repo } = preparar();
    repo.save.mockRejectedValue({ code: '23505' });
    await expect(servico.salvar(10, dto({ recurring: true }))).rejects.toThrow('exceção anual');
    await expect(servico.salvar(10, dto())).rejects.toThrow('exceção para esta data');
  });
  it('permite converter pelo mesmo endpoint de edição e mantém o setor no filtro', async () => {
    const { servico, repo } = preparar();
    await servico.salvar(10, dto({ recurring: true }), 7);
    expect(repo.update).toHaveBeenCalledWith({ id: 7, department_id: 10 },
      expect.objectContaining({ date: '2000-11-02', recurring: true }));
  });
  it('o DTO não converte texto false em verdadeiro e mantém o padrão pontual', () => {
    expect(validateSync(plainToInstance(SalvarExcecaoHorarioDto, dto({ recurring: 'false' as never }))).length).toBe(1);
    expect(plainToInstance(SalvarExcecaoHorarioDto, dto()).recurring).toBe(false);
  });
});
