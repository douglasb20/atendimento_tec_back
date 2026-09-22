import { Injectable } from '@nestjs/common';

import { PermissionsRepository } from './permissions.repository';

/** Quanto tempo as permissões de um usuário ficam em memória. */
const CACHE_MS = 30_000;

@Injectable()
export class PermissionService {

  /**
   * Cache das permissões por usuário.
   *
   * O guard roda em toda requisição protegida, e com papéis a consulta virou
   * uma junção de três tabelas. Trinta segundos é curto o bastante para uma
   * permissão revogada sumir rápido - e o `invalida` cobre o caso em que a
   * mudança precisa valer na hora.
   *
   * Em memória de propósito: o dado é pequeno, reconstrói-se sozinho, e pô-lo
   * no Redis traria invalidação distribuída para um problema que não a exige.
   * Com mais de uma instância da API, cada uma tem o seu - o desencontro dura
   * os mesmos trinta segundos.
   */
  private readonly cache = new Map<number, { permissoes: Set<string>; expiraEm: number }>();

  constructor(
    private readonly permissionRepository: PermissionsRepository,
  ) {}

  /** Descarta o cache de um usuário, ou de todos. Chamar ao mexer em papéis. */
  invalida(userId?: number): void {
    if (userId === undefined) {
      this.cache.clear();
      return;
    }
    this.cache.delete(userId);
  }

  private async permissoesDoUsuario(userId: number): Promise<Set<string>> {
    const agora = Date.now();
    const emCache = this.cache.get(userId);

    if (emCache && emCache.expiraEm > agora) {
      return emCache.permissoes;
    }

    const nomes = await this.permissionRepository.nomesPermissoesDoUsuario(userId);
    const permissoes = new Set(nomes);

    this.cache.set(userId, { permissoes, expiraEm: agora + CACHE_MS });

    return permissoes;
  }

  /** Semântica OU: basta ter uma das permissões pedidas. */
  async hasPermission(userId: number, permission: string[]): Promise<boolean> {
    if (!permission?.length) return false;

    const doUsuario = await this.permissoesDoUsuario(userId);

    return permission.some((p) => doUsuario.has(p));
  }

  async findAll() {
    return this.permissionRepository.findAllPermissions();
  }

  async permissionByUser(user_id: number) {
    return this.permissionRepository.permissionByUser(user_id);
  }


  // =============== Modules =============

  async findAllModules() {
    return this.permissionRepository.findAllModules();
  }
}
