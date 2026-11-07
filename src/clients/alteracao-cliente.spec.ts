import { ClientService } from './clients.service';

jest.mock('@/Utils', () => ({ runInTransaction: async (banco: { manager: object }, acao: (manager: object) => unknown) => acao(banco.manager) }));
jest.mock('./clients.repository', () => ({ ClientRepository: class {} }));
jest.mock('./entities/clients.entity', () => ({ Clients: class {} }));
jest.mock('contacts/contacts.repository', () => ({ ContactsRepository: class {} }));
jest.mock('@/tags/tags.repository', () => ({ TagsRepository: class {} }));
jest.mock('@/custom-fields/custom-fields.service', () => ({ CustomFieldsService: class {} }));

describe('Alteração do cadastro de cliente', () => {
  function preparar() {
    const gravado = { id: 7, nome: 'Nome antigo', cnpj: '11111111000111', tags: [{ id: 1 }] };
    const manager = {
      save: jest.fn(async (_entidade: unknown, dados: object) => {
        Object.assign(gravado, Object.fromEntries(Object.entries(dados).filter(([, valor]) => valor !== undefined)));
        return { ...gravado };
      }),
    };
    const repositorio = {
      findOneBy: jest.fn(async () => ({ ...gravado })),
      findById: jest.fn(async () => ({ ...gravado })),
    };
    const tags = { findByIds: jest.fn(async (ids: number[]) => ids.map(id => ({ id }))) };
    const servico = new ClientService(repositorio as never, {} as never, tags as never, {} as never, { manager } as never);
    return { servico, gravado };
  }

  it.each([{ tag_ids: [] }, { tag_ids: [2] }])('mantém nome e CNPJ novos ao salvar etiquetas $tag_ids', async ({ tag_ids }) => {
    const { servico, gravado } = preparar();
    await servico.updateClient(7, { nome: 'Nome novo', cnpj: '22222222000122', tag_ids });
    expect(gravado.nome).toBe('Nome novo');
    expect(gravado.cnpj).toBe('22222222000122');
    expect(gravado.tags).toEqual(tag_ids.map(id => ({ id })));
  });

  it('preserva etiquetas e CNPJ quando não são enviados', async () => {
    const { servico, gravado } = preparar();
    await servico.updateClient(7, { nome: 'Nome novo' });
    expect(gravado).toMatchObject({ nome: 'Nome novo', cnpj: '11111111000111', tags: [{ id: 1 }] });
  });
});
