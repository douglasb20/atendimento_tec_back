import { MenuHandler } from './menu.handler';
import { VariableStore } from '../variable-store';
import { ExecutionBudget } from '../execution-budget';
import type { NodeExecutionContext } from './node-handler.interface';

describe('Tentativas inválidas do Menu', () => {
  const handler = new MenuHandler();
  function contexto(maximo = 3): NodeExecutionContext {
    return { node: { id: 'menu', type: 'menu', position: { x: 0, y: 0 }, data: {
      title: 'Como ajudar?', options: [{ id: 'suporte', text: 'Suporte' }], invalidOptionOutputHandle: 'invalid',
      invalidAttemptLimitEnabled: true, maxInvalidAttempts: maximo,
    } }, flowVersionId: 9, variables: new VariableStore({}), budget: new ExecutionBudget({}) };
  }
  const responder = async (ctx: NodeExecutionContext, texto: string) => {
    ctx.resumePayload = { text: texto }; ctx.variables.set('_last_message', texto);
    return handler.execute(ctx);
  };

  it('mantém o comportamento anterior quando o limite não está configurado', async () => {
    const ctx = contexto(); delete ctx.node.data.invalidAttemptLimitEnabled; delete ctx.node.data.maxInvalidAttempts;
    for (let n = 0; n < 12; n++) expect(await responder(ctx, 'errado')).toEqual({ kind: 'continue', outputHandle: 'invalid' });
    expect(ctx.variables.get('_menu_tentativas_invalidas')).toBeUndefined();
  });
  it('a terceira inválida segue a nova saída, não a saída de erro comum', async () => {
    const ctx = contexto();
    expect(await responder(ctx, 'errado')).toEqual({ kind: 'continue', outputHandle: 'invalid' });
    expect(await responder(ctx, 'errado')).toEqual({ kind: 'continue', outputHandle: 'invalid' });
    expect(await responder(ctx, 'errado')).toEqual({ kind: 'continue', outputHandle: 'limite-tentativas' });
  });
  it('com limite 1, a primeira inválida já segue o limite', async () => {
    expect(await responder(contexto(1), 'errado')).toEqual({ kind: 'continue', outputHandle: 'limite-tentativas' });
  });
  it.each(['1', ' SUPORTE '])('uma escolha válida por %s zera a contagem', async texto => {
    const ctx = contexto(); await responder(ctx, 'errado'); await responder(ctx, 'errado');
    expect(await responder(ctx, texto)).toEqual({ kind: 'continue', outputHandle: 'suporte' });
    expect(await responder(ctx, 'errado')).toEqual({ kind: 'continue', outputHandle: 'invalid' });
    expect(await responder(ctx, 'errado')).toEqual({ kind: 'continue', outputHandle: 'invalid' });
  });
  it('preserva contagem após serializar e reconstruir o estado entre jobs', async () => {
    const ctx = contexto(); await responder(ctx, 'errado');
    ctx.variables = new VariableStore(JSON.parse(JSON.stringify(ctx.variables.toJSON())));
    ctx.resumePayload = undefined; await handler.execute(ctx);
    ctx.variables = new VariableStore(JSON.parse(JSON.stringify(ctx.variables.toJSON())));
    await responder(ctx, 'errado');
    expect(await responder(ctx, 'errado')).toMatchObject({ outputHandle: 'limite-tentativas' });
  });
  it('não mistura menus da mesma execução nem ids iguais de versões diferentes', async () => {
    const ctx = contexto(2); await responder(ctx, 'errado');
    ctx.node = { ...ctx.node, id: 'outro-menu' }; expect(await responder(ctx, 'errado')).toMatchObject({ outputHandle: 'invalid' });
    ctx.node = { ...ctx.node, id: 'menu' }; ctx.flowVersionId = 10;
    expect(await responder(ctx, 'errado')).toMatchObject({ outputHandle: 'invalid' });
    ctx.flowVersionId = 9; expect(await responder(ctx, 'errado')).toMatchObject({ outputHandle: 'limite-tentativas' });
  });
  it('uma nova execução começa sem contagem e esgotar o limite também limpa a anterior', async () => {
    const ctx = contexto(1); await responder(ctx, 'errado');
    expect(ctx.variables.get('_menu_tentativas_invalidas')).toEqual({});
    expect(await responder(contexto(3), 'errado')).toMatchObject({ outputHandle: 'invalid' });
  });
  it('entrar e aguardar resposta não conta tentativa nem altera o tempo limite', async () => {
    const ctx = contexto(); ctx.node.data.replyTimeoutEnabled = true; ctx.node.data.replyTimeoutMinutes = 5;
    await responder(ctx, 'errado'); ctx.resumePayload = undefined;
    const antes = JSON.stringify(ctx.variables.toJSON());
    expect(await handler.execute(ctx)).toMatchObject({ kind: 'suspend', waitingFor: { timeout_minutes: 5, timeout_handle: 'sem-resposta' } });
    expect(JSON.stringify(ctx.variables.toJSON())).toBe(antes);
  });

  it('reenviar o menu suspende no mesmo nó sem exigir saída inválida conectada', async () => {
    const ctx = contexto(); ctx.node.data.invalidOptionAction = 'repeat_menu';
    const resposta = await responder(ctx, 'errado');
    expect(resposta).toMatchObject({ kind: 'suspend', waitingFor: { node_id: 'menu', type: 'contact_reply' },
      effects: [{ type: 'send_text', text: 'Como ajudar?\n1. Suporte' }] });
    expect(ctx.variables.get('_menu_tentativas_invalidas')).toEqual({ '9:menu': 1 });
  });

  it('aguardar outra resposta mantém a espera sem enviar mensagens', async () => {
    const ctx = contexto(); ctx.node.data.invalidOptionAction = 'wait_reply';
    expect(await responder(ctx, 'errado')).toMatchObject({ kind: 'suspend', effects: [] });
  });

  it.each(['repeat_menu', 'wait_reply'])('o excesso prevalece sobre %s na terceira inválida', async acao => {
    const ctx = contexto(); ctx.node.data.invalidOptionAction = acao;
    await responder(ctx, 'errado'); await responder(ctx, 'errado');
    expect(await responder(ctx, 'errado')).toEqual({ kind: 'continue', outputHandle: 'limite-tentativas' });
  });

  it.each(['repeat_menu', 'wait_reply'])('escolha válida continua saindo pela opção no modo %s', async acao => {
    const ctx = contexto(); ctx.node.data.invalidOptionAction = acao;
    await responder(ctx, 'errado');
    expect(await responder(ctx, '1')).toEqual({ kind: 'continue', outputHandle: 'suporte' });
    expect(ctx.variables.get('_menu_tentativas_invalidas')).toEqual({});
  });

  it('sem limite pode reenviar após cada resposta, sem loop automático', async () => {
    const ctx = contexto(); ctx.node.data.invalidOptionAction = 'repeat_menu'; ctx.node.data.invalidAttemptLimitEnabled = false;
    for (let n = 0; n < 12; n++) expect(await responder(ctx, 'errado')).toMatchObject({ kind: 'suspend' });
    expect(ctx.variables.get('_menu_tentativas_invalidas')).toBeUndefined();
  });
});
