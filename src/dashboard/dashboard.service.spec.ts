import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DashboardService } from './dashboard.service';
import { MovimentoPorSemanaDto, PERIODOS_MOVIMENTO } from './dto/movimento-por-semana.dto';

jest.mock('@/contacts/entities/contacts.entity', () => ({ Contacts: class {} }));
jest.mock('@/support-chats/entities/support-chats.entity', () => ({ SupportChats: class {} }));
jest.mock('@/channels/entities/channels.entity', () => ({ Channels: class {} }));
jest.mock('@/presenca/presenca.service', () => ({ PresencaService: class {} }));

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
    expect(sql).toContain('sc.created_at < l.fim');
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

  it('oferece os cinco períodos, nesta ordem', () => {
    expect([...PERIODOS_MOVIMENTO]).toEqual([
      'esta_semana',
      'semana_passada',
      'este_mes',
      'ultimo_mes',
      'ultimos_seis_meses',
    ]);
  });

  // O SQL tem dois CASE: o de início vem antes de `AS inicio`, o de fim depois.
  const casesDo = (sql: string) => {
    const corte = sql.indexOf('AS inicio');
    return { inicio: sql.slice(0, corte), fim: sql.slice(corte) };
  };
  const domingoAtual = "date_trunc('day', local) - EXTRACT(DOW FROM local)::int * INTERVAL '1 day'";

  it('semana passada vai do domingo anterior ao domingo atual, fechada', async () => {
    const repositorio = { query: jest.fn().mockResolvedValue([]) };
    await new DashboardService({} as never, repositorio as never).movimentoPorSemana('semana_passada');
    const { inicio, fim } = casesDo(repositorio.query.mock.calls[0][0]);
    expect(inicio).toContain(`WHEN 'semana_passada' THEN ${domingoAtual} - INTERVAL '7 days'\n`);
    expect(fim).toContain(`WHEN 'semana_passada' THEN ${domingoAtual}\n`);
  });

  it('último mês vai do dia 1 do mês anterior ao dia 1 do mês atual, fechado', async () => {
    const repositorio = { query: jest.fn().mockResolvedValue([]) };
    await new DashboardService({} as never, repositorio as never).movimentoPorSemana('ultimo_mes');
    const { inicio, fim } = casesDo(repositorio.query.mock.calls[0][0]);
    expect(inicio).toContain("WHEN 'ultimo_mes' THEN date_trunc('month', local) - INTERVAL '1 month'\n");
    expect(fim).toContain("WHEN 'ultimo_mes' THEN date_trunc('month', local)\n");
  });

  it('períodos abertos continuam indo até agora', async () => {
    const repositorio = { query: jest.fn().mockResolvedValue([]) };
    await new DashboardService({} as never, repositorio as never).movimentoPorSemana('esta_semana');
    const sql: string = repositorio.query.mock.calls[0][0];
    expect(sql).toContain("COALESCE(fim_fechado, 'infinity'::timestamptz) AS fim");
  });

  it('rejeita filtros desconhecidos sem interpolar SQL', () => {
    expect(validateSync(plainToInstance(MovimentoPorSemanaDto, { periodo: "'; DROP TABLE support_chats; --" })).length).toBe(1);
  });

  it('o DTO usa a semana atual como padrão', () => {
    expect(plainToInstance(MovimentoPorSemanaDto, {}).periodo).toBe('esta_semana');
  });
});
