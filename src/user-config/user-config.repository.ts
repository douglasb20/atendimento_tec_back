import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { UserConfig } from './entities/user-config.entity';

@Injectable()
export class UserConfigRepository extends Repository<UserConfig> {
  constructor(protected dataSource: DataSource) {
    super(UserConfig, dataSource.manager);
  }

  /** As preferências gravadas de um usuário. As não gravadas usam o padrão. */
  async doUsuario(userId: number): Promise<UserConfig[]> {
    return this.find({ where: { user_id: userId } });
  }

  /**
   * Grava uma preferência.
   *
   * `upsert` em vez de buscar-e-decidir: duas abas salvando a mesma chave ao
   * mesmo tempo chegariam juntas, as duas não achariam nada, e a segunda
   * violaria o índice único. Mesmo motivo do `system_settings`.
   */
  async grava(
    userId: number,
    chave: string,
    valor: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager.upsert(
      UserConfig,
      { user_id: userId, chave, valor, updated_at: new Date() },
      ['user_id', 'chave'],
    );
  }
}
