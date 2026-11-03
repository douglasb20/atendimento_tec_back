import { lerDestinoEncaminhamento, validarDestinoEncaminhamento } from './encaminhamento-atendimento';

describe('Destino do encaminhamento humano', () => {
  it('a fila ignora um atendente residual de uma seleção anterior', () => {
    expect(lerDestinoEncaminhamento({ destination: 'department', department_id: 10, user_id: 7 }))
      .toEqual({ departmentId: 10, userId: null });
  });
  it.each([
    {}, { destination: 'outro', department_id: 10 }, { destination: 'department' },
    { destination: 'user', department_id: 10 }, { destination: 'user', department_id: 10, user_id: -1 },
  ])('recusa destino incompleto ou inválido %j', dados => {
    expect(() => lerDestinoEncaminhamento(dados)).toThrow();
  });
  it('exige o setor mesmo quando há um atendente para evitar ambiguidade', () => {
    expect(() => lerDestinoEncaminhamento({ destination: 'user', user_id: 7 })).toThrow('setor');
  });
  it.each(['setor', 'canal', 'atendente'])('recusa %s indisponível antes de alterar o atendimento', async problema => {
    const manager = { query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM departments')) return problema === 'setor' ? [] : [{ id: 10 }];
      if (sql.includes('channel_x_department')) return problema === 'canal' ? [] : [{ existe: 1 }];
      return problema === 'atendente' ? [] : [{ id: 7 }];
    }) };
    await expect(validarDestinoEncaminhamento(manager as never, { departmentId: 10, userId: 7 }, 4)).rejects.toThrow();
    expect(manager.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
  });
});
