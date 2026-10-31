import { minutosDeEspera, validarTemposDeResposta } from './tempo-resposta';

describe('Configuração do tempo limite de resposta', () => {
  const no = (type = 'menu', data: object = {}) => ({ id: 'pergunta', type, position: { x: 0, y: 0 },
    data: { replyTimeoutEnabled: true, replyTimeoutMinutes: 5, ...data } });
  const grafo = (node = no()) => ({ nodes: [node, { id: 'fim', type: 'finish', data: {}, position: { x: 0, y: 0 } }],
    edges: [{ id: 'saida', source: 'pergunta', sourceHandle: 'sem-resposta', target: 'fim', targetHandle: null }] });

  it('não altera fluxos antigos ou com a opção desligada', () => {
    expect(minutosDeEspera({})).toBeUndefined();
    expect(minutosDeEspera({ replyTimeoutEnabled: false, replyTimeoutMinutes: 0 })).toBeUndefined();
  });
  it.each([0, -1, 1.5, 10081, NaN, Infinity, '5', undefined])('recusa prazo inválido: %s', valor => {
    expect(() => minutosDeEspera({ replyTimeoutEnabled: true, replyTimeoutMinutes: valor as number })).toThrow();
  });
  it('aceita de 1 minuto até 7 dias', () => {
    expect(minutosDeEspera({ replyTimeoutEnabled: true, replyTimeoutMinutes: 1 })).toBe(1);
    expect(minutosDeEspera({ replyTimeoutEnabled: true, replyTimeoutMinutes: 10080 })).toBe(10080);
  });
  it('valida menu e mensagem após resposta com a saída conectada', () => {
    expect(() => validarTemposDeResposta(grafo())).not.toThrow();
    expect(() => validarTemposDeResposta(grafo(no('message', { continueOn: 'after_reply' })))).not.toThrow();
  });
  it('recusa mensagem automática com prazo', () => {
    expect(() => validarTemposDeResposta(grafo(no('message', { continueOn: 'auto' })))).toThrow('Após resposta');
  });
  it('impede publicar sem conectar Sem resposta', () => {
    const graph = grafo(); graph.edges = [];
    expect(() => validarTemposDeResposta(graph)).toThrow('Conecte a saída');
  });
  it('impede colisão entre a opção do menu e a saída do tempo limite', () => {
    expect(() => validarTemposDeResposta(grafo(no('menu', { options: [{ id: 'sem-resposta', text: 'Opção' }] })))).toThrow('reservada');
  });
});
