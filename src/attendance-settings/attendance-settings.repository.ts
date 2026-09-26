import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { AttendanceSettings } from './entities/attendance-settings.entity';

@Injectable()
export class AttendanceSettingsRepository extends Repository<AttendanceSettings> {
  constructor(protected dataSource: DataSource) {
    super(AttendanceSettings, dataSource.manager);
  }

  async todos(): Promise<AttendanceSettings[]> {
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
      AttendanceSettings,
      { chave, valor, updated_by, updated_at: new Date() },
      ['chave'],
    );
  }
}
