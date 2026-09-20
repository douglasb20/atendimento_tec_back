import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import { PasswordResets } from './entities/password-resets.entity';

@Injectable()
export class PasswordResetRepository extends Repository<PasswordResets> {
  constructor(protected dataSource: DataSource) {
    super(PasswordResets, dataSource.manager);
  }

  /**
   * O pedido correspondente ao token, com o usuário carregado.
   *
   * Busca pelo hash — o token em claro não existe no banco. Traz mesmo os
   * expirados e os já usados, porque quem chama precisa distinguir os casos
   * para dizer ao usuário o que aconteceu.
   */
  async findByTokenHash(token_hash: string): Promise<PasswordResets | null> {
    return this.findOne({ where: { token_hash }, relations: ['user'] });
  }

  /**
   * Invalida os pedidos pendentes de um usuário.
   *
   * Chamado antes de criar um novo: sem isso, quem pede duas vezes por não ter
   * recebido o primeiro e-mail fica com dois links válidos ao mesmo tempo.
   */
  async invalidaPendentes(user_id: number, manager: EntityManager): Promise<void> {
    await manager.update(
      PasswordResets,
      { user_id, used_at: IsNull() },
      { used_at: new Date() },
    );
  }

  async marcaComoUsado(id: number, manager: EntityManager): Promise<void> {
    await manager.update(PasswordResets, id, { used_at: new Date() });
  }
}
