import { DataSource } from 'typeorm';
import { AcessoAtendimentoService } from './acesso-atendimento.service';
import { PermissionService } from './permission.service';

jest.mock('./permission.service', () => ({ PermissionService: class {} }));

describe('Visibilidade dos atendimentos por setor', () => {
  const permissoes = new Set<string>();
  let master = 0;
  let setores = [10];
  const banco = {
    query: async (sql: string) => sql.includes('FROM users') ? [{ is_superuser: master }]
      : setores.map((department_id) => ({ department_id })),
  } as unknown as DataSource;
  const servico = new AcessoAtendimentoService(banco, {
    hasPermission: async (_id: number, nomes: string[]) => nomes.some((nome) => permissoes.has(nome)),
  } as PermissionService);
  const fila = (department_id: number | null) => ({ department_id, user_id: null, support_chat_status_id: 1 });

  beforeEach(() => { permissoes.clear(); master = 0; setores = [10]; });

  it('libera o próprio setor e a triagem, mas impede outro setor', async () => {
    expect(await servico.podeVer(1, fila(10))).toBe(true);
    expect(await servico.podeVer(1, fila(null))).toBe(true);
    expect(await servico.podeVer(1, fila(20))).toBe(false);
  });

  it('usuário sem setores só acessa a triagem', async () => {
    setores = [];
    expect(await servico.podeVer(1, fila(10))).toBe(false);
    expect(await servico.podeVer(1, fila(null))).toBe(true);
  });

  it('libera qualquer setor vinculado ao atendente', async () => {
    setores = [10, 20];
    expect(await servico.podeVer(1, fila(20))).toBe(true);
  });

  it('ver atendimentos alheios não libera setores alheios', async () => {
    permissoes.add('support.chat:view_others');
    expect(await servico.podeVer(1, { ...fila(20), user_id: 2, support_chat_status_id: 2 })).toBe(false);
  });

  it('ver todos os setores mantém a restrição a atendimentos de outro dono', async () => {
    permissoes.add('support.chat:view_all_departments');
    expect(await servico.podeVer(1, fila(20))).toBe(true);
    expect(await servico.podeVer(1, { ...fila(20), user_id: 2, support_chat_status_id: 2 })).toBe(false);
    permissoes.add('support.chat:view_others');
    expect(await servico.podeVer(1, { ...fila(20), user_id: 2, support_chat_status_id: 2 })).toBe(true);
  });

  it('preserva acesso do dono e do master', async () => {
    expect(await servico.podeVer(1, { ...fila(20), user_id: 1, support_chat_status_id: 2 })).toBe(true);
    master = 1;
    expect(await servico.podeVer(1, { ...fila(20), user_id: 2, support_chat_status_id: 2 })).toBe(true);
  });

  it('bloqueia a rota individual quando a conversa é de outro setor', async () => {
    const dados = { query: async (sql: string) => sql.includes('FROM support_chats') ? [fila(20)] : banco.query(sql) } as unknown as DataSource;
    const acesso = new AcessoAtendimentoService(dados, { hasPermission: async () => false } as unknown as PermissionService);
    await expect(acesso.validar(1, 100)).rejects.toThrow('Você não tem acesso');
  });
});
