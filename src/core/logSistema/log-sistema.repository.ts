import { DataSource, EntityManager, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { LogSistema } from './log-sistema.entity';

@Injectable()
export class LogSistemaRepository extends Repository<LogSistema> {
  constructor(dataSource: DataSource) {
    super(LogSistema, dataSource.manager);
  }

  async saveLog(log: LogSistema, manager: EntityManager) {
    return await manager.save(LogSistema, log);
  }
}
