import { ChatbotsService } from './chatbots.service';
import { Chatbots } from './entities/chatbots.entity';
import { ChatbotFlowVersions } from './entities/chatbot-flow-versions.entity';

jest.mock('@/Utils', () => ({ runInTransaction: async (banco: { manager: object }, acao: (manager: object) => unknown) => acao(banco.manager) }));
jest.mock('@/storage/storage.service', () => ({ StorageService: class {} }));
jest.mock('./entities/chatbots.entity', () => ({ Chatbots: class {} }));
jest.mock('./entities/chatbot-flow-versions.entity', () => ({ ChatbotFlowVersions: class {} }));
jest.mock('./chatbots.repository', () => ({ ChatbotsRepository: class {} }));
jest.mock('./chatbot-flow-versions.repository', () => ({ ChatbotFlowVersionsRepository: class {}, GRAFO_VAZIO: {} }));

describe('Rascunho editável com versão publicada', () => {
  function preparar() {
    const grafo = (texto: string) => ({ nodes: [
      { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} },
      { id: 'msg', type: 'message', position: { x: 200, y: 0 }, data: { value: texto } },
    ], edges: [{ id: 'ligacao', source: 'start', target: 'msg', sourceHandle: null, targetHandle: null }] });
    const chat = { id: 1, name: 'Teste', type: 'entrada', active: true, current_published_version_id: 10 };
    const draft = { id: 9, chatbot_id: 1, graph: grafo('Nova'), status: 'draft' };
    const publicada = { id: 10, graph: grafo('Anterior') };
    const manager = {
      findOne: jest.fn(async (entidade: unknown) => entidade === Chatbots ? { ...chat } : { ...draft }),
      update: jest.fn(async (entidade: unknown, _id: number, dados: object) => Object.assign(entidade === Chatbots ? chat : draft, dados)),
      query: jest.fn().mockResolvedValue([]),
    };
    const repositorio = { findById: jest.fn().mockResolvedValue({ ...chat }),
      idsComAlteracoesNaoPublicadas: jest.fn().mockResolvedValue([1]),
      nomeEmUso: jest.fn().mockResolvedValue(false), findCanaisDoChatbot: jest.fn().mockResolvedValue([]) };
    const versoes = { findDraft: jest.fn().mockResolvedValue(draft), findById: jest.fn().mockResolvedValue(publicada),
      publicarDraft: jest.fn().mockResolvedValue({ id: 11, version_number: 2 }) };
    const servico = new ChatbotsService(repositorio as never, versoes as never, {} as never, { manager } as never);
    return { servico, chat, draft, publicada, manager, repositorio, versoes, grafo };
  }

  it('salva só o rascunho e mantém a versão publicada imutável', async () => {
    const { servico, manager, publicada, grafo, chat } = preparar();
    const resultado = await servico.saveFlow(1, grafo('Edição em andamento'));
    expect(resultado).toMatchObject({ id: 9, has_unpublished_changes: true });
    expect(chat.current_published_version_id).toBe(10);
    expect(publicada.graph.nodes[1].data.value).toBe('Anterior');
    expect(manager.update).toHaveBeenCalledWith(ChatbotFlowVersions, 9, expect.anything());
    expect(manager.update).not.toHaveBeenCalledWith(Chatbots, expect.anything(), expect.anything());
  });

  it('publica uma versão nova sem exigir despublicação', async () => {
    const { servico, manager, publicada } = preparar();
    expect(await servico.publish(1)).toMatchObject({ current_published_version_id: 11, has_unpublished_changes: false });
    expect(manager.update).toHaveBeenCalledWith(Chatbots, 1, { current_published_version_id: 11 });
    expect(publicada.graph.nodes[1].data.value).toBe('Anterior');
  });

  it('uma publicação inválida não retira a versão em uso', async () => {
    const { servico, draft, manager, versoes, chat } = preparar();
    draft.graph.nodes = [];
    await expect(servico.publish(1)).rejects.toThrow('Início');
    expect(chat.current_published_version_id).toBe(10);
    expect(versoes.publicarDraft).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('repetir uma publicação sem mudanças não cria outra versão', async () => {
    const { servico, publicada, draft, versoes } = preparar();
    draft.graph = JSON.parse(JSON.stringify(publicada.graph));
    expect(await servico.publish(1)).toMatchObject({ current_published_version_id: 10 });
    expect(versoes.publicarDraft).not.toHaveBeenCalled();
  });

  it.each(['saveFlow', 'publish', 'unpublish'])('%s usa o mesmo lock para serializar alterações de publicação', async metodo => {
    const { servico, manager, grafo } = preparar();
    if (metodo === 'saveFlow') await servico.saveFlow(1, grafo('Edição'));
    else if (metodo === 'publish') await servico.publish(1);
    else await servico.unpublish(1);
    expect(manager.findOne.mock.calls[0]).toEqual([Chatbots, expect.objectContaining({ lock: { mode: 'pessimistic_write' } })]);
  });

  it('editar o nome não regrava o ponteiro antigo de publicação', async () => {
    const { servico, manager, chat } = preparar();
    chat.current_published_version_id = 20;
    await servico.update(1, { name: 'Outro nome' });
    expect(manager.update).toHaveBeenCalledWith(Chatbots, 1, { name: 'Outro nome' });
    expect(chat.current_published_version_id).toBe(20);
  });
});
