import { DataSource, EntityManager, Repository } from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { LogSistema } from './log-sistema.entity';

@Injectable()
export class LogSistemaRepository extends Repository<LogSistema> {
  private readonly logger = new Logger(LogSistemaRepository.name);
  constructor(dataSource: DataSource) {
    super(LogSistema, dataSource.manager);
  }

  async saveLog(log: LogSistema, manager: EntityManager) {
    return await manager.save(LogSistema, log);
  }
}
