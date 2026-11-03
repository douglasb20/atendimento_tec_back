import { validarFluxoSaida } from './validar-fluxo-saida';
import type { ChatbotFlowGraph } from './entities/chatbot-flow-versions.entity';

describe('Validação do fluxo de saída', () => {
  function grafo(tipo: string, dados = {}): ChatbotFlowGraph {
    return { nodes: [{ id: 'pergunta', type: tipo, data: dados, position: { x: 0, y: 0 } },
      { id: 'fim', type: 'finish', data: {}, position: { x: 1, y: 1 } }],
    edges: [{ id: 'prazo', source: 'pergunta', sourceHandle: 'sem-resposta', target: 'fim', targetHandle: null }] };
  }
  it('aceita uma mensagem automática sem obrigar espera ou outra despedida', () => {
    expect(() => validarFluxoSaida(grafo('message', { continueOn: 'auto', value: 'Obrigado!' }))).not.toThrow();
  });
  it.each(['menu', 'message'])('exige limite de resposta em %s que aguarda o cliente', tipo => {
    expect(() => validarFluxoSaida(grafo(tipo, { continueOn: 'after_reply' }))).toThrow('tempo limite');
  });
  it('aceita uma espera com prazo e saída conectada', () => {
    expect(() => validarFluxoSaida(grafo('menu', { replyTimeoutEnabled: true, replyTimeoutMinutes: 5 }))).not.toThrow();
  });
  it('recusa espera com prazo mas saída desconectada', () => {
    const graph = grafo('menu', { replyTimeoutEnabled: true, replyTimeoutMinutes: 5 }); graph.edges = [];
    expect(() => validarFluxoSaida(graph)).toThrow('Conecte');
  });
  it('não permite reescrever o setor do atendimento humano encerrado', () => {
    expect(() => validarFluxoSaida(grafo('set_department', { department_id: 1 }))).toThrow('setor');
  });
});
