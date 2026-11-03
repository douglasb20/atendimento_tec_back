import { ExecutionEngine } from './execution-engine.service';
import type { WaitingFor } from './entities/chatbot-flow-executions.entity';

jest.mock('@/Utils', () => ({ runInTransaction: async (_banco: unknown, acao: (manager: object) => unknown) => acao({}) }));
jest.mock('@/support-chats/support-chats.service', () => ({ SupportChatsService: class {}, TIPO_INTERNO_POR_MIDIA: {} }));
jest.mock('@/whatsapp/whatsapp.service', () => ({ WhatsappService: class {} }));
jest.mock('@/support-chats/messages/messages.service', () => ({ MessagesService: class {} }));
jest.mock('@/storage/storage.service', () => ({ StorageService: class {} }));
jest.mock('@/chatbots/chatbot-flow-versions.repository', () => ({ ChatbotFlowVersionsRepository: class {} }));
jest.mock('@/chatbots/entities/chatbots.entity', () => ({ Chatbots: class {} }));
jest.mock('./chatbot-flow-executions.repository', () => ({ ChatbotFlowExecutionsRepository: class {} }));
jest.mock('./node-handlers/node-handlers.registry', () => ({ NodeHandlersRegistry: class {} }));

describe('Separação da fila do chatbot e espera humana', () => {
  function preparar(resultado: object = { kind: 'finish' }) {
    const execucao = { id: 10, support_chat_id: 20, status: 'running', version: 1,
      phase: 'entrada' as 'entrada' | 'saida',
      current_flow_version_id: 1, variables: {}, counters: {}, call_stack: [], waiting_for: null as WaitingFor | null };
    const repositorio = { findById: jest.fn().mockResolvedValue(execucao),
      salvarComLockOuFalha: jest.fn(), abortarDoAtendimento: jest.fn(), renovarPrazoAposEnvio: jest.fn() };
    const chat = { support_chat_status_id: 3, user_id: null,
      contact: { remote_jid: 'cliente' }, channel: { session_id: 'canal' } };
    const atendimentos = { bloquearParaExecucaoBot: jest.fn().mockResolvedValue(true),
      findParaEnvioBot: jest.fn().mockResolvedValue(chat), whatsappChatStateEmit: jest.fn(),
      devolverBotParaEspera: jest.fn(), encerrarPorChatbot: jest.fn(), concluirPosAtendimento: jest.fn() };
    const handler = { execute: jest.fn().mockResolvedValue(resultado) };
    const whatsapp = { sendMessage: jest.fn().mockResolvedValue({ messageId: 'mensagem' }) };
    const graph = { nodes: [{ id: 'inicio', type: 'start' }], edges: [] as { source: string; sourceHandle: string; target: string }[] };
    const motor = new ExecutionEngine({} as never, repositorio as never,
      { findById: jest.fn().mockResolvedValue({ graph }) } as never,
      { resolve: () => handler } as never, whatsapp as never, atendimentos as never,
      { saveOutgoing: jest.fn() } as never, {} as never);
    return { motor, repositorio, atendimentos, handler, whatsapp, chat, execucao, graph };
  }

  it('devolve para Espera quando o fluxo termina normalmente', async () => {
    const { motor, atendimentos } = preparar();
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.devolverBotParaEspera).toHaveBeenCalledWith(20);
  });

  it('conclui o pós-atendimento sem reabrir a espera humana', async () => {
    const { motor, execucao, atendimentos } = preparar();
    execucao.phase = 'saida';
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.concluirPosAtendimento).toHaveBeenCalledWith(20);
    expect(atendimentos.devolverBotParaEspera).not.toHaveBeenCalled();
    expect(atendimentos.encerrarPorChatbot).not.toHaveBeenCalled();
  });

  it('o nó Encerrar no fluxo de saída não repete despedida nem encerra novamente', async () => {
    const { motor, execucao, atendimentos } = preparar({ kind: 'close_support_chat', enviarDespedida: true });
    execucao.phase = 'saida';
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.encerrarPorChatbot).not.toHaveBeenCalled();
    expect(atendimentos.concluirPosAtendimento).toHaveBeenCalledWith(20);
  });

  it('envia no mesmo atendimento finalizado, preservando o atendente histórico', async () => {
    const { motor, execucao, atendimentos, whatsapp, chat } = preparar({ kind: 'finish', effects: [{ type: 'send_text', text: 'Até logo' }] });
    execucao.phase = 'saida';
    atendimentos.findParaEnvioBot.mockResolvedValue({ ...chat, support_chat_status_id: 5, user_id: 7, pos_atendimento_ativo: true } as never);
    await motor.step(10, { kind: 'start' });
    expect(whatsapp.sendMessage).toHaveBeenCalled();
    expect(atendimentos.concluirPosAtendimento.mock.invocationCallOrder[0]).toBeGreaterThan(whatsapp.sendMessage.mock.invocationCallOrder[0]);
  });

  it('mantém o protocolo reservado enquanto o fluxo de saída aguarda resposta', async () => {
    const { motor, execucao, atendimentos } = preparar({ kind: 'suspend', waitingFor: { node_id: 'inicio' } });
    execucao.phase = 'saida';
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.concluirPosAtendimento).not.toHaveBeenCalled();
  });

  it('libera o pós-atendimento mesmo quando o envio final falha', async () => {
    const { motor, execucao, atendimentos, whatsapp, chat } = preparar({ kind: 'finish', effects: [{ type: 'send_text', text: 'Até logo' }] });
    execucao.phase = 'saida';
    atendimentos.findParaEnvioBot.mockResolvedValue({ ...chat, support_chat_status_id: 5, pos_atendimento_ativo: true } as never);
    whatsapp.sendMessage.mockRejectedValue(new Error('Provider indisponível'));
    await expect(motor.step(10, { kind: 'start' })).rejects.toThrow('Provider indisponível');
    expect(atendimentos.concluirPosAtendimento).toHaveBeenCalledWith(20);
  });

  it('um retry de conclusão libera a reserva sem reenviar mensagens', async () => {
    const { motor, execucao, atendimentos, handler, whatsapp } = preparar();
    execucao.phase = 'saida'; execucao.status = 'completed';
    await motor.step(10, { kind: 'start' }, true);
    expect(atendimentos.concluirPosAtendimento).toHaveBeenCalledWith(20);
    expect(handler.execute).not.toHaveBeenCalled(); expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('um job duplicado normal não libera a reserva enquanto outro job pode estar enviando', async () => {
    const { motor, execucao, atendimentos } = preparar();
    execucao.phase = 'saida'; execucao.status = 'completed';
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.concluirPosAtendimento).not.toHaveBeenCalled();
  });

  it('o prazo Sem resposta conclui a saída sem devolver o atendimento para Espera', async () => {
    const { motor, execucao, graph, atendimentos } = preparar();
    execucao.phase = 'saida'; execucao.status = 'suspended';
    execucao.waiting_for = { type: 'contact_reply', node_id: 'inicio', since: new Date().toISOString(), token: 'prazo',
      timeout_at: new Date(Date.now() - 1000).toISOString(), timeout_handle: 'sem-resposta' };
    graph.nodes.push({ id: 'fim', type: 'finish' }); graph.edges.push({ source: 'inicio', target: 'fim', sourceHandle: 'sem-resposta' });
    await motor.step(10, { kind: 'timeout', waitingToken: 'prazo' });
    expect(atendimentos.concluirPosAtendimento).toHaveBeenCalledWith(20);
    expect(atendimentos.devolverBotParaEspera).not.toHaveBeenCalled();
  });

  it('devolve para Espera quando o último nó não tem conexão de saída', async () => {
    const { motor, atendimentos } = preparar({ kind: 'continue', outputHandle: null });
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.devolverBotParaEspera).toHaveBeenCalledWith(20);
  });

  it('permanece em Chatbot enquanto aguarda resposta do cliente', async () => {
    const { motor, atendimentos } = preparar({ kind: 'suspend', waitingFor: { node_id: 'inicio' } });
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.devolverBotParaEspera).not.toHaveBeenCalled();
  });

  it('libera a fila do bot se o nó falhar', async () => {
    const { motor, atendimentos, handler } = preparar();
    handler.execute.mockRejectedValue(new Error('Falha simulada'));
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.devolverBotParaEspera).toHaveBeenCalledWith(20);
  });

  it('encerra pelo nó próprio antes da devolução condicional à espera', async () => {
    const { motor, atendimentos } = preparar({ kind: 'close_support_chat', enviarDespedida: false });
    await motor.step(10, { kind: 'start' });
    expect(atendimentos.encerrarPorChatbot).toHaveBeenCalledWith(20, false);
    expect(atendimentos.encerrarPorChatbot.mock.invocationCallOrder[0])
      .toBeLessThan(atendimentos.devolverBotParaEspera.mock.invocationCallOrder[0]);
  });

  it('aborta um job pendente se o atendimento já saiu do chatbot', async () => {
    const { motor, atendimentos, repositorio, handler } = preparar();
    atendimentos.bloquearParaExecucaoBot.mockResolvedValue(false);
    await motor.step(10, { kind: 'start' });
    expect(repositorio.abortarDoAtendimento).toHaveBeenCalledWith(20, expect.anything());
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('não envia efeitos se um atendente assumir após o processamento', async () => {
    const { motor, atendimentos, whatsapp, chat } = preparar({ kind: 'finish', effects: [{ type: 'send_text', text: 'Teste' }] });
    atendimentos.findParaEnvioBot.mockResolvedValue({ ...chat, support_chat_status_id: 2 });
    await motor.step(10, { kind: 'start' });
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('não envia efeitos após desabilitar o chatbot no canal', async () => {
    const { motor, atendimentos, whatsapp, chat } = preparar({ kind: 'finish', effects: [{ type: 'send_text', text: 'Teste' }] });
    atendimentos.findParaEnvioBot.mockResolvedValue({ ...chat, channel: { ...chat.channel, chatbot_habilitado: false } } as never);
    await motor.step(10, { kind: 'start' });
    expect(whatsapp.sendMessage).not.toHaveBeenCalled();
  });

  it('só devolve à espera depois do envio da última mensagem', async () => {
    const { motor, atendimentos, whatsapp } = preparar({ kind: 'finish', effects: [{ type: 'send_text', text: 'Teste' }] });
    await motor.step(10, { kind: 'start' });
    expect(whatsapp.sendMessage).toHaveBeenCalled();
    expect(whatsapp.sendMessage.mock.invocationCallOrder[0])
      .toBeLessThan(atendimentos.devolverBotParaEspera.mock.invocationCallOrder[0]);
  });

  function prepararEspera() {
    const estado = preparar();
    estado.execucao.status = 'suspended';
    estado.execucao.waiting_for = { type: 'contact_reply', node_id: 'inicio', since: new Date().toISOString(),
      token: 'pergunta-1', timeout_minutes: 1, timeout_handle: 'sem-resposta', timeout_at: new Date(Date.now() - 1000).toISOString() };
    estado.graph.nodes.push({ id: 'lembrete', type: 'message' });
    estado.graph.edges.push({ source: 'inicio', sourceHandle: 'sem-resposta', target: 'lembrete' });
    return estado;
  }

  it('o prazo vencido segue Sem resposta sem repetir a pergunta original', async () => {
    const { motor, handler } = prepararEspera();
    await motor.step(10, { kind: 'timeout', waitingToken: 'pergunta-1' });
    expect(handler.execute).toHaveBeenCalledTimes(1);
    expect(handler.execute.mock.calls[0][0].node.id).toBe('lembrete');
    expect(handler.execute.mock.calls[0][0].resumePayload).toBeUndefined();
  });

  it('não dispara antes do prazo', async () => {
    const { motor, execucao, handler } = prepararEspera();
    execucao.waiting_for.timeout_at = new Date(Date.now() + 60000).toISOString();
    await motor.step(10, { kind: 'timeout', waitingToken: 'pergunta-1' });
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('ignora o temporizador de uma pergunta anterior, mesmo no mesmo nó', async () => {
    const { motor, handler } = prepararEspera();
    await motor.step(10, { kind: 'timeout', waitingToken: 'pergunta-antiga' });
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('uma resposta recebida impede o timeout, mesmo se o job de resposta estiver atrasado', async () => {
    const { motor, execucao, handler } = prepararEspera();
    execucao.waiting_for.reply = { text: '1', received_at: new Date().toISOString() };
    await motor.step(10, { kind: 'timeout', waitingToken: 'pergunta-1' });
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('retoma com a resposta guardada no banco, não com texto de um job antigo', async () => {
    const { motor, execucao, handler } = prepararEspera();
    execucao.waiting_for.reply = { text: 'Suporte', received_at: new Date().toISOString() };
    await motor.step(10, { kind: 'resume', waitingToken: 'pergunta-1', resumePayload: { text: 'Texto antigo' } });
    const contexto = handler.execute.mock.calls[0][0];
    expect(contexto.resumePayload.text).toBe('Suporte');
    expect(contexto.variables.get('_last_message')).toBe('Suporte');
  });

  it('um job de início duplicado não reenvia uma pergunta já suspensa', async () => {
    const { motor, handler } = prepararEspera();
    await motor.step(10, { kind: 'start' });
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('não executa timeout de uma conversa já assumida ou encerrada', async () => {
    const { motor, atendimentos, handler } = prepararEspera();
    atendimentos.bloquearParaExecucaoBot.mockResolvedValue(false);
    await motor.step(10, { kind: 'timeout', waitingToken: 'pergunta-1' });
    expect(handler.execute).not.toHaveBeenCalled();
  });

  it('renova a contagem após enviar e cria uma identidade nova por pergunta', async () => {
    const { motor, repositorio } = preparar({ kind: 'suspend', waitingFor: {
      type: 'contact_reply', node_id: 'inicio', timeout_minutes: 5, timeout_handle: 'sem-resposta',
    } });
    await motor.step(10, { kind: 'start' });
    const espera = repositorio.salvarComLockOuFalha.mock.calls[0][2].waiting_for;
    expect(espera.token).toEqual(expect.any(String));
    expect(espera.timeout_at).toEqual(expect.any(String));
    expect(repositorio.renovarPrazoAposEnvio).toHaveBeenCalledWith(10, espera.token, 5);
  });
});
