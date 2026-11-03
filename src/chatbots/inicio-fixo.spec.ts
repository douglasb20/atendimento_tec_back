import { validarInicioFixo } from './inicio-fixo';
import type { ChatbotFlowGraph } from './entities/chatbot-flow-versions.entity';

describe('Início obrigatório e fixo', () => {
  const grafo = (): ChatbotFlowGraph => ({ nodes: [{ id: 'start', type: 'start', position: { x: 120, y: 70 }, data: {} },
    { id: 'mensagem', type: 'message', position: { x: 300, y: 70 }, data: {} }], edges: [] });
  it('aceita o início na posição em que o fluxo já foi salvo', () => expect(() => validarInicioFixo(grafo(), grafo())).not.toThrow());
  it('não permite remover o início nem mudar seu tipo', () => {
    const removido = grafo(); removido.nodes.shift(); expect(() => validarInicioFixo(removido, grafo())).toThrow('não pode ser removido');
    const alterado = grafo(); alterado.nodes[0].type = 'message'; expect(() => validarInicioFixo(alterado, grafo())).toThrow('não pode ser removido');
  });
  it.each(['x', 'y'])('não permite mover o início pelo eixo %s', eixo => {
    const movido = grafo(); movido.nodes[0].position[eixo] += 10;
    expect(() => validarInicioFixo(movido, grafo())).toThrow('não pode ser movido');
  });
  it('não permite substituir seu identificador', () => {
    const alterado = grafo(); alterado.nodes[0].id = 'outro-inicio'; expect(() => validarInicioFixo(alterado, grafo())).toThrow('substituído');
  });
  it('não aceita dois inícios nem outro nó reutilizando o id', () => {
    const duplicado = grafo(); duplicado.nodes[1].type = 'start'; expect(() => validarInicioFixo(duplicado)).toThrow('exatamente um');
    const mesmoId = grafo(); mesmoId.nodes[1].id = 'start'; expect(() => validarInicioFixo(mesmoId)).toThrow('compartilhado');
  });
  it('permite mover e remover outros nós, além de mudar ligações', () => {
    const alterado = grafo(); alterado.nodes.pop();
    expect(() => validarInicioFixo(alterado, grafo())).not.toThrow();
    const movido = grafo(); movido.nodes[1].position.x = 900; expect(() => validarInicioFixo(movido, grafo())).not.toThrow();
  });
  it('impede publicar um fluxo sem início e aceita publicação na posição existente', () => {
    expect(() => validarInicioFixo({ nodes: [], edges: [] })).toThrow('exatamente um');
    expect(() => validarInicioFixo(grafo())).not.toThrow();
  });
  it('aceita recuperar um rascunho legado sem início', () => expect(() => validarInicioFixo(grafo(), { nodes: [], edges: [] })).not.toThrow());
  it('recusa posição inválida sem produzir erro interno', () => {
    const alterado = grafo(); alterado.nodes[0].position = undefined as never;
    expect(() => validarInicioFixo(alterado)).toThrow('posição válidos');
  });
});
