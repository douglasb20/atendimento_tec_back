import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { SystemSettings } from './entities/system-settings.entity';

@Injectable()
export class SystemSettingsRepository extends Repository<SystemSettings> {
  constructor(protected dataSource: DataSource) {
    super(SystemSettings, dataSource.manager);
  }

  async todos(): Promise<SystemSettings[]> {
    return this.find();
  }

  /**
   * Grava o valor da chave, criando a linha se ela não existir.
   *
   * `upsert` em vez de buscar-e-decidir: duas requisições simultâneas na mesma
   * chave produziriam duas linhas, e o índice único faria a segunda falhar.
   */
  async grava(
    chave: string,
    valor: string,
    updated_by: number | null,
    manager: EntityManager,
  ): Promise<void> {
    await manager.upsert(
      SystemSettings,
      { chave, valor, updated_by, updated_at: new Date() },
      ['chave'],
    );
  }
}
