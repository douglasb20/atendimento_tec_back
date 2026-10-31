import { avaliarDisponibilidadeSetor, DadosDisponibilidade } from './disponibilidade-setor';
import { validarIntervalosExcecao } from './intervalos-excecao';
import { partesDataAtendimento } from '@/core/data-atendimento';

describe('Disponibilidade do setor: exceção, feriado e semana', () => {
  const semana = [
    { weekday: 5, start_time: '08:00:00', end_time: '12:00:00' },
    { weekday: 5, start_time: '14:00:00', end_time: '18:00:00' },
  ];
  const base: DadosDisponibilidade = {
    ativo: true, respeitarFeriados: true, feriado: false,
    diaSemana: 5, hora: '09:00', semana,
  };

  it('mantém o setor disponível com o controle geral desligado', () => {
    expect(avaliarDisponibilidadeSetor({ ...base, ativo: false, feriado: true, excecao: { mode: 'fechado', intervals: [] } })).toBe(true);
  });

  it.each([['08:00', true], ['11:59', true], ['12:00', false], ['13:00', false], ['14:00', true], ['18:00', false]])(
    'respeita os limites e o intervalo de almoço às %s', (hora, esperado) => {
      expect(avaliarDisponibilidadeSetor({ ...base, hora: String(hora) })).toBe(esperado);
    },
  );

  it('fecha no feriado somente quando o setor optou por respeitá-lo', () => {
    expect(avaliarDisponibilidadeSetor({ ...base, feriado: true })).toBe(false);
    expect(avaliarDisponibilidadeSetor({ ...base, feriado: true, respeitarFeriados: false })).toBe(true);
  });

  it('a exceção fechada prevalece mesmo sem feriado', () => {
    expect(avaliarDisponibilidadeSetor({ ...base, excecao: { mode: 'fechado', intervals: [] } })).toBe(false);
  });

  it('a exceção normal permite trabalhar no feriado, obedecendo à semana', () => {
    const dados: DadosDisponibilidade = { ...base, feriado: true, excecao: { mode: 'normal', intervals: [] } };
    expect(avaliarDisponibilidadeSetor(dados)).toBe(true);
    expect(avaliarDisponibilidadeSetor({ ...dados, diaSemana: 0 })).toBe(false);
    expect(avaliarDisponibilidadeSetor({ ...dados, hora: '13:00' })).toBe(false);
  });

  it('horário especial substitui a semana e admite vários intervalos', () => {
    const dados: DadosDisponibilidade = { ...base, diaSemana: 0, feriado: true,
      excecao: { mode: 'especial', intervals: [
        { start_time: '09:00', end_time: '11:00' }, { start_time: '15:00', end_time: '16:00' },
      ] },
    };
    expect(avaliarDisponibilidadeSetor({ ...dados, hora: '10:00' })).toBe(true);
    expect(avaliarDisponibilidadeSetor({ ...dados, hora: '12:00' })).toBe(false);
    expect(avaliarDisponibilidadeSetor({ ...dados, hora: '15:30' })).toBe(true);
    expect(avaliarDisponibilidadeSetor({ ...dados, hora: '16:00' })).toBe(false);
  });

  it('preserva o comportamento legado de semana ainda não configurada', () => {
    expect(avaliarDisponibilidadeSetor({ ...base, semana: [] })).toBe(true);
    expect(avaliarDisponibilidadeSetor({ ...base, semana: [], feriado: true })).toBe(false);
  });

  it('conta a data no fuso de Brasília, incluindo a virada do ano', () => {
    expect(partesDataAtendimento(new Date('2027-01-01T01:30:00Z'))).toMatchObject({ data: '2026-12-31', hora: '22:30', diaSemana: 4 });
    expect(partesDataAtendimento(new Date('2027-01-01T03:00:00Z'))).toMatchObject({ data: '2027-01-01', hora: '00:00', diaSemana: 5 });
  });
});

describe('Validação dos intervalos especiais', () => {
  it('recusa ausência de intervalos, sobreposição e horários invertidos', () => {
    expect(() => validarIntervalosExcecao('especial', [])).toThrow('ao menos um');
    expect(() => validarIntervalosExcecao('especial', [
      { start_time: '08:00', end_time: '12:00' }, { start_time: '11:00', end_time: '13:00' },
    ])).toThrow('sobrepor');
    expect(() => validarIntervalosExcecao('especial', [{ start_time: '12:00', end_time: '08:00' }])).toThrow('posterior');
    expect(() => validarIntervalosExcecao('especial', [{ start_time: '08:00', end_time: '08:00' }])).toThrow('posterior');
  });

  it('valida horas reais e permite fechar à meia-noite', () => {
    expect(() => validarIntervalosExcecao('especial', [{ start_time: '29:00', end_time: '30:00' }])).toThrow('válidos');
    expect(() => validarIntervalosExcecao('especial', [{ start_time: '08:60', end_time: '12:00' }])).toThrow('válidos');
    expect(validarIntervalosExcecao('especial', [{ start_time: '00:00', end_time: '24:00' }])).toHaveLength(1);
  });

  it('ordena os intervalos e permite janelas adjacentes', () => {
    expect(validarIntervalosExcecao('especial', [
      { start_time: '10:00', end_time: '12:00' }, { start_time: '08:00', end_time: '10:00' },
    ])[0].start_time).toBe('08:00');
  });

  it('impede intervalos nos modos fechado e normal', () => {
    expect(validarIntervalosExcecao('fechado', [])).toEqual([]);
    expect(() => validarIntervalosExcecao('normal', [{ start_time: '08:00', end_time: '12:00' }])).toThrow('só podem');
  });
});
