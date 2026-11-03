import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DashboardService } from './dashboard.service';
import { MovimentoPorSemanaDto, PERIODOS_MOVIMENTO } from './dto/movimento-por-semana.dto';

jest.mock('@/contacts/entities/contacts.entity', () => ({ Contacts: class {} }));
jest.mock('@/support-chats/entities/support-chats.entity', () => ({ SupportChats: class {} }));

describe('Distribuição semanal do dashboard', () => {
  it.each(PERIODOS_MOVIMENTO)('consulta o período %s no fuso de Brasília', async periodo => {
    const serie = Array.from({ length: 7 }, (_, diaSemana) => ({ diaSemana, total: 0 }));
    const repositorio = { query: jest.fn().mockResolvedValue(serie) };
    const servico = new DashboardService({} as never, repositorio as never);
    expect(await servico.movimentoPorSemana(periodo)).toEqual(serie);
    expect(repositorio.query).toHaveBeenCalledWith(expect.any(String), ['America/Sao_Paulo', periodo]);
    const sql = repositorio.query.mock.calls[0][0];
    expect(sql).toContain('generate_series(0, 6)');
    expect(sql).toContain('sc.created_at >= l.inicio');
    expect(sql).toContain('sc.created_at <= l.agora');
    expect(sql).not.toContain('finished_at');
  });

  it('começa na semana atual quando não há filtro', async () => {
    const repositorio = { query: jest.fn().mockResolvedValue([]) };
    await new DashboardService({} as never, repositorio as never).movimentoPorSemana();
    expect(repositorio.query.mock.calls[0][1][1]).toBe('esta_semana');
  });

  it.each(PERIODOS_MOVIMENTO)('aceita o filtro %s pela API', periodo => {
    expect(validateSync(plainToInstance(MovimentoPorSemanaDto, { periodo }))).toEqual([]);
  });

  it('rejeita filtros desconhecidos sem interpolar SQL', () => {
    expect(validateSync(plainToInstance(MovimentoPorSemanaDto, { periodo: "'; DROP TABLE support_chats; --" })).length).toBe(1);
  });

  it('o DTO usa a semana atual como padrão', () => {
    expect(plainToInstance(MovimentoPorSemanaDto, {}).periodo).toBe('esta_semana');
  });
});
