import { acaoOpcaoInvalida, limiteDeTentativas, validarTentativasMenu } from './tentativas-menu';
import type { ChatbotFlowGraph } from './entities/chatbot-flow-versions.entity';

describe('Publicação de Menu com limite de tentativas', () => {
  const grafo = (): ChatbotFlowGraph => ({ nodes: [{ id: 'menu', type: 'menu', position: { x: 0, y: 0 },
    data: { invalidAttemptLimitEnabled: true, maxInvalidAttempts: 3, invalidOptionOutputHandle: 'invalid', options: [{ id: 'suporte', text: 'Suporte' }] } }],
  edges: [{ id: 'repetir', source: 'menu', sourceHandle: 'invalid', target: 'menu', targetHandle: null },
    { id: 'limite', source: 'menu', sourceHandle: 'limite-tentativas', target: 'menu', targetHandle: null }] });
  it.each([0, 11, 1.5, null, undefined])('recusa limite inválido %s', valor => {
    expect(() => limiteDeTentativas({ invalidAttemptLimitEnabled: true, maxInvalidAttempts: valor })).toThrow('1 a 10');
  });
  it('não aceita string no lugar da habilitação', () => {
    expect(() => limiteDeTentativas({ invalidAttemptLimitEnabled: 'true' as never, maxInvalidAttempts: 3 })).toThrow();
  });
  it('fluxos antigos ou com limite desligado não exigem novas ligações', () => {
    expect(() => validarTentativasMenu({ nodes: [{ id: 'menu', type: 'menu', position: { x: 0, y: 0 }, data: {} }], edges: [] })).not.toThrow();
  });
  it('aceita um menu com as duas saídas conectadas', () => expect(() => validarTentativasMenu(grafo())).not.toThrow());
  it.each(['invalid', 'limite-tentativas'])('recusa saída %s desconectada', handle => {
    const graph = grafo(); graph.edges = graph.edges.filter(aresta => aresta.sourceHandle !== handle);
    expect(() => validarTentativasMenu(graph)).toThrow('Conecte');
  });
  it('com limite 1 só exige a saída que será usada', () => {
    const graph = grafo(); graph.nodes[0].data.maxInvalidAttempts = 1; graph.edges = graph.edges.filter(aresta => aresta.sourceHandle !== 'invalid');
    expect(() => validarTentativasMenu(graph)).not.toThrow();
  });
  it('recusa destino removido e aplicação em outro tipo de nó', () => {
    const graph = grafo(); graph.edges[1].target = 'removido'; expect(() => validarTentativasMenu(graph)).toThrow('Conecte');
    graph.nodes[0].type = 'message'; expect(() => validarTentativasMenu(graph)).toThrow('só pode');
  });
  it.each(['invalid', 'limite-tentativas', 'sem-resposta'])('não permite opção colidir com saída reservada %s', id => {
    const graph = grafo(); graph.nodes[0].data.options = [{ id, text: 'Inválida' }];
    expect(() => validarTentativasMenu(graph)).toThrow('reservadas');
  });
  it('não muda a ação de grafos antigos', () => expect(acaoOpcaoInvalida({})).toBe('follow_output'));
  it('recusa uma ação desconhecida', () => expect(() => acaoOpcaoInvalida({ invalidOptionAction: 'desconhecida' as never })).toThrow('ação válida'));
  it.each(['repeat_menu', 'wait_reply'])('o modo %s não exige saída inválida, mas exige excesso quando limitado', acao => {
    const graph = grafo(); graph.nodes[0].data.invalidOptionAction = acao;
    graph.edges = graph.edges.filter(aresta => aresta.sourceHandle !== 'invalid');
    expect(() => validarTentativasMenu(graph)).not.toThrow();
    graph.edges = []; expect(() => validarTentativasMenu(graph)).toThrow('Excesso de tentativas');
  });
  it('seguimento explícito exige ligar a saída inválida mesmo sem limite', () => {
    const graph = grafo(); graph.nodes[0].data.invalidOptionAction = 'follow_output';
    graph.nodes[0].data.invalidAttemptLimitEnabled = false; graph.edges = [];
    expect(() => validarTentativasMenu(graph)).toThrow('Opção inválida');
  });
});
