import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { LogSistemaRepository } from './log-sistema.repository';

type LogdataType = {
  rota: string;
  id_usuario: number;
  method: string;
  datetime_request: Date;
  params: string;
  body: string;
  queries: string[];
};

@Injectable()
export class LogSistemaService {
  private queryRunner: QueryRunner;
  constructor(
    private readonly logSistemaRepository: LogSistemaRepository,
    private dataSource: DataSource,
  ) {
    this.queryRunner = this.dataSource.createQueryRunner();
  }

  async salvarLog(logdata: LogdataType) {
    try {
      await this.queryRunner.startTransaction();
      const log = this.logSistemaRepository.create({
        rota: logdata.rota,
        user_id: logdata.id_usuario,
        metodo: logdata.method,
        request_data: {
          param: logdata.params,
          body: logdata.body,
        },
        queries: JSON.stringify(logdata.queries),
      });

      await this.logSistemaRepository.saveLog(log, this.queryRunner.manager);
      await this.queryRunner.commitTransaction();
    } catch (err) {
      await this.queryRunner.rollbackTransaction();
      throw err;
    }
  }
}
