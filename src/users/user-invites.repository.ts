import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import { UserInvites } from './entities/user-invites.entity';

@Injectable()
export class UserInvitesRepository extends Repository<UserInvites> {
  constructor(dataSource: DataSource) {
    super(UserInvites, dataSource.manager);
  }

  /**
   * O convite correspondente ao token, com o usuário carregado.
   *
   * Busca pelo hash - o token em claro não existe no banco. Traz mesmo os
   * expirados e os já usados, porque quem chama precisa distinguir os casos
   * para dizer ao convidado o que aconteceu.
   */
  async findByTokenHash(token_hash: string): Promise<UserInvites | null> {
    return this.findOne({ where: { token_hash }, relations: ['user'] });
  }

  /**
   * O convite mais recente de um usuário, usado ou não.
   *
   * É o que decide o status exibido na listagem: pendente (não usado, dentro
   * do prazo), expirado (não usado, fora do prazo) ou aceito (usado). Sem
   * nenhum convite - usuário do fluxo antigo, criado antes desta feature -
   * conta como aceito.
   */
  async maisRecentePorUsuario(user_id: number): Promise<UserInvites | null> {
    return this.findOne({ where: { user_id }, order: { created_at: 'DESC' } });
  }

  /**
   * Idem, mas para vários usuários de uma vez - a listagem não pode fazer uma
   * consulta por linha.
   */
  async maisRecentePorUsuarios(user_ids: number[]): Promise<UserInvites[]> {
    if (user_ids.length === 0) return [];

    return this.createQueryBuilder('ui')
      .distinctOn(['ui.user_id'])
      .where('ui.user_id IN (:...user_ids)', { user_ids })
      .orderBy('ui.user_id', 'ASC')
      .addOrderBy('ui.created_at', 'DESC')
      .getMany();
  }

  /**
   * Invalida os convites pendentes de um usuário.
   *
   * Chamado antes de criar um novo (reenvio ou geração de link): sem isso,
   * dois links ficariam válidos ao mesmo tempo.
   */
  async invalidaPendentes(user_id: number, manager: EntityManager): Promise<void> {
    await manager.update(UserInvites, { user_id, used_at: IsNull() }, { used_at: new Date() });
  }

  async marcaComoUsado(id: number, manager: EntityManager): Promise<void> {
    await manager.update(UserInvites, id, { used_at: new Date() });
  }
}
