import type { UserDevices } from './entities/user-devices.entity';

// O repositório real puxa a entidade, e a entidade o ciclo de `Users` que o
// Jest não resolve (ver memória do projeto); o teste usa o repositório em memória.
jest.mock('./devices.repository', () => ({ DevicesRepository: class {} }));

import { DevicesService } from './devices.service';

/**
 * Repositório em memória com o pedaço do TypeORM que o service usa: o
 * suficiente para testar o comportamento (o token muda de dono, remover não
 * falha) sem banco.
 */
function repositorioEmMemoria() {
  const linhas: Partial<UserDevices>[] = [];
  return {
    linhas,
    consultas: 0,
    async upsert(dados: Partial<UserDevices>, _conflito: string[]) {
      const existente = linhas.find((l) => l.token === dados.token);
      if (existente) Object.assign(existente, dados);
      else linhas.push({ ...dados });
    },
    async delete(criterio: { token: string }) {
      const i = linhas.findIndex((l) => l.token === criterio.token);
      if (i >= 0) linhas.splice(i, 1);
    },
    async ativos() {
      return linhas.filter((l) => l.user_id !== 99).map((l) => ({ user_id: l.user_id!, token: l.token! }));
    },
    async find(opcoes: { where: { user_id: { value: number[] } } }) {
      this.consultas++;
      const ids = opcoes.where.user_id.value;
      return linhas.filter((l) => ids.includes(l.user_id!));
    },
  };
}

describe('DevicesService', () => {
  let repo: ReturnType<typeof repositorioEmMemoria>;
  let service: DevicesService;

  beforeEach(() => {
    repo = repositorioEmMemoria();
    service = new DevicesService(repo as never);
  });

  it('registra um celular novo', async () => {
    await service.registrar(1, 'token-a', 'Xiaomi');

    expect(await service.tokensDe([1])).toEqual([{ user_id: 1, token: 'token-a' }]);
  });

  it('o mesmo celular registrado por outro usuário passa a ser dele', async () => {
    await service.registrar(1, 'token-a', 'Xiaomi');
    await service.registrar(2, 'token-a', 'Xiaomi');

    expect(await service.tokensDe([1])).toEqual([]);
    expect(await service.tokensDe([2])).toEqual([{ user_id: 2, token: 'token-a' }]);
  });

  it('remover um token que não existe não lança', async () => {
    await expect(service.removerPorToken('nao-existe')).resolves.toBeUndefined();
  });

  it('remove pelo token', async () => {
    await service.registrar(1, 'token-a');
    await service.removerPorToken('token-a');

    expect(await service.tokensDe([1])).toEqual([]);
  });

  it('lista vazia de usuários não consulta o banco', async () => {
    expect(await service.tokensDe([])).toEqual([]);
    expect(repo.consultas).toBe(0);
  });

  it('celulares de usuários ativos, para o push escolher quem avisa', async () => {
    await service.registrar(1, 'token-a');
    await service.registrar(99, 'token-inativo');

    expect(await service.ativos()).toEqual([{ user_id: 1, token: 'token-a' }]);
  });
});
