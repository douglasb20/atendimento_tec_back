import { DisponibilidadeSetorService } from './disponibilidade-setor.service';

jest.mock('@/holidays/holidays.repository', () => ({ HolidaysRepository: class {} }));
jest.mock('./departments.repository', () => ({ DepartmentsRepository: class {} }));
jest.mock('./entities/department-schedule-exceptions.entity', () => ({}));

describe('Disponibilidade com exceções anuais', () => {
  function preparar(excecoes: object[]) {
    const banco = { query: jest.fn().mockResolvedValue(excecoes) };
    const setores = { findById: jest.fn().mockResolvedValue({ schedule_enabled: true, respect_holidays: true }),
      findSchedule: jest.fn().mockResolvedValue([{ weekday: 1, start_time: '08:00', end_time: '18:00' }]) };
    const feriados = { existeEm: jest.fn().mockResolvedValue(true) };
    return { banco, setores, feriados, servico: new DisponibilidadeSetorService(setores as never, feriados as never, banco as never) };
  }
  it('procura a data completa ou a data anual, priorizando a completa', async () => {
    const { banco, servico } = preparar([]);
    await servico.verificar(10, new Date('2026-11-02T13:00:00Z'));
    expect(banco.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY recurring ASC LIMIT 1'), [10, '2026-11-02', 11, 2]);
  });
  it('o plantão anual especial abre dentro do intervalo e fecha fora', async () => {
    const { servico, feriados } = preparar([{ mode: 'especial', intervals: [{ start_time: '08:00', end_time: '12:00' }] }]);
    expect((await servico.verificar(10, new Date('2027-11-02T13:00:00Z'))).disponivel).toBe(true);
    expect((await servico.verificar(10, new Date('2027-11-02T16:00:00Z'))).disponivel).toBe(false);
    expect(feriados.existeEm).not.toHaveBeenCalled();
  });
  it('uma exceção fechada tem prioridade sobre feriado e semana', async () => {
    const { servico } = preparar([{ mode: 'fechado', intervals: [] }]);
    expect((await servico.verificar(10, new Date('2026-11-02T13:00:00Z'))).disponivel).toBe(false);
  });
  it('controle de horário desligado continua ignorando todas as exceções', async () => {
    const { servico, setores, banco } = preparar([]);
    setores.findById.mockResolvedValue({ schedule_enabled: false, respect_holidays: true });
    expect((await servico.verificar(10)).disponivel).toBe(true);
    expect(banco.query).not.toHaveBeenCalled();
  });
});
