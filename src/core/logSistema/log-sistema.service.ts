import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { LogSistemaRepository } from './log-sistema.repository';

type LogdataType = {
  rota: string;
  id_usuario: number;
  ip: string;
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
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const log = this.logSistemaRepository.create({
        rota: logdata.rota,
        user_id: logdata.id_usuario,
        ip: logdata.ip,
        metodo: logdata.method,
        request_data: {
          param: logdata.params,
          body: logdata.body,
        },
        queries: JSON.stringify(logdata.queries),
      });

      await this.logSistemaRepository.saveLog(log, this.queryRunner.manager);
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
