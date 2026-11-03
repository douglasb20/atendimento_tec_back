import { permiteAutomacaoContato, interromperAutomacoesContato } from './politica-atendimento';

describe('Política de atendimento do contato', () => {
  it('preserva automações de contatos antigos e permite o modo normal', () => {
    expect(permiteAutomacaoContato({})).toBe(true);
    expect(permiteAutomacaoContato({ ignore_support: false, automation_disabled: false })).toBe(true);
  });
  it.each([{ ignore_support: true }, { automation_disabled: true }, { ignore_support: true, automation_disabled: true }, null, undefined])(
    'não permite automações para %j', contato => expect(permiteAutomacaoContato(contato)).toBe(false),
  );
  it('interrompe as esperas na ordem dos locks do motor e devolve só os ids modificados', async () => {
    const manager = { query: jest.fn().mockResolvedValueOnce([])
      .mockResolvedValueOnce([[{ id: '12' }, { id: '15' }], 2]).mockResolvedValueOnce([[], 0]) };
    expect(await interromperAutomacoesContato(3, manager as never)).toEqual([12, 15]);
    expect(manager.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(manager.query.mock.calls[1][0]).toContain('user_id IS NULL');
    expect(manager.query.mock.calls[2][0]).toContain("status IN ('running', 'suspended')");
    expect(manager.query.mock.calls.every(([, parametros]) => parametros[0] === 3)).toBe(true);
  });
});
