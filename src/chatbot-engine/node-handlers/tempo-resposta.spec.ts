import { MessageHandler } from './message.handler';
import { MenuHandler } from './menu.handler';
import { VariableStore } from '../variable-store';
import { ExecutionBudget } from '../execution-budget';
import type { NodeExecutionContext } from './node-handler.interface';

describe('Espera por resposta nos nós', () => {
  const contexto = (type: string, data: Record<string, unknown>): NodeExecutionContext => ({
    node: { id: 'pergunta', type, data, position: { x: 0, y: 0 } },
    variables: new VariableStore({}), budget: new ExecutionBudget({}),
  });
  it('mensagem após resposta suspende com o prazo configurado', async () => {
    const resultado = await new MessageHandler().execute(contexto('message', {
      value: 'Como ajudar?', continueOn: 'after_reply', replyTimeoutEnabled: true, replyTimeoutMinutes: 2,
    }));
    expect(resultado).toMatchObject({ kind: 'suspend', waitingFor: { timeout_minutes: 2, timeout_handle: 'sem-resposta' } });
  });
  it('mensagem automática continua sem criar espera', async () => {
    expect(await new MessageHandler().execute(contexto('message', { value: 'Olá', continueOn: 'auto' })))
      .toMatchObject({ kind: 'continue', outputHandle: null });
  });
  it('menu suspende com tempo limite e mantém o envio das opções', async () => {
    const resultado = await new MenuHandler().execute(contexto('menu', {
      title: 'Menu', options: [{ id: 'opcao', text: 'Suporte' }], invalidOptionOutputHandle: 'invalid',
      replyTimeoutEnabled: true, replyTimeoutMinutes: 1,
    }));
    expect(resultado).toMatchObject({ kind: 'suspend', waitingFor: { timeout_minutes: 1 },
      effects: [{ type: 'send_text', text: 'Menu\n1. Suporte' }] });
  });
  it('a resposta normal do menu continua seguindo a opção escolhida', async () => {
    const ctx = contexto('menu', { options: [{ id: 'suporte', text: 'Suporte' }], invalidOptionOutputHandle: 'invalid' });
    ctx.resumePayload = { text: '1' }; ctx.variables.set('_last_message', '1');
    expect(await new MenuHandler().execute(ctx)).toEqual({ kind: 'continue', outputHandle: 'suporte' });
  });
});
