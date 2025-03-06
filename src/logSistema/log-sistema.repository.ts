import { DataSource, EntityManager, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { LogSistemaEntity } from './log-sistema.entity';

@Injectable()
export class LogSistemaRepository extends Repository<LogSistemaEntity> {
  constructor(dataSource: DataSource) {
    super(LogSistemaEntity, dataSource.manager);
  }

  async saveLog(log: LogSistemaEntity, manager: EntityManager) {
    return await manager.save(LogSistemaEntity, log);
  }
}
