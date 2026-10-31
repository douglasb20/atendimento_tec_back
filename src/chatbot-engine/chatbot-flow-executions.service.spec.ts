import { ChatbotFlowExecutionsService } from './chatbot-flow-executions.service';
jest.mock('@/chatbots/entities/chatbots.entity', () => ({ Chatbots: class {} }));
jest.mock('./entities/chatbot-flow-executions.entity', () => ({ ChatbotFlowExecutions: class {} }));
jest.mock('./chatbot-flow-executions.repository', () => ({ ChatbotFlowExecutionsRepository: class {} }));
jest.mock('./processors/chatbot-flow-execution.processor', () => ({}));

describe('Recuperação de prazos e respostas do chatbot', () => {
  function preparar(pendentes: object[]) {
    const fila = { add: jest.fn() };
    const repositorio = { buscarRetomadasPendentes: jest.fn().mockResolvedValue(pendentes) };
    return { fila, servico: new ChatbotFlowExecutionsService(fila as never, repositorio as never) };
  }
  it('recupera um prazo vencido e usa identidade única por espera', async () => {
    const { fila, servico } = preparar([{ id: 1, waiting_for: { token: 'espera-1' } }]);
    await servico.recuperarRetomadasPendentes();
    expect(fila.add).toHaveBeenCalledWith('process', { executionId: 1, trigger: { kind: 'timeout', waitingToken: 'espera-1' } },
      expect.objectContaining({ jobId: 'timeout-1-espera-1', attempts: 3 }));
  });
  it('recupera resposta já recebida, em vez de executar timeout', async () => {
    const { fila, servico } = preparar([{ id: 1, waiting_for: { token: 'espera-1', reply: { text: 'Suporte' } } }]);
    await servico.recuperarRetomadasPendentes();
    expect(fila.add.mock.calls[0][1].trigger).toEqual({ kind: 'resume', waitingToken: 'espera-1', resumePayload: { text: 'Suporte' } });
  });
  it('não agenda nada quando não há esperas vencidas/respostas pendentes', async () => {
    const { fila, servico } = preparar([]);
    await servico.recuperarRetomadasPendentes();
    expect(fila.add).not.toHaveBeenCalled();
  });
});
