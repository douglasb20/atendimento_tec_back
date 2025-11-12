import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProtocolCounters } from './entities/protocol-counters.entity';

@Injectable()
export class ProtocolCountersRepository extends Repository<ProtocolCounters> {
  constructor(dataSource: DataSource) {
    super(ProtocolCounters, dataSource.createEntityManager());
  }

  async generateProtocol(manager: EntityManager): Promise<string> {
    let protocol = await this.createQueryBuilder('pc').select('pc.*').getRawOne();

    if (!protocol) {
      protocol = this.create({ counter: 1 });
    } else {
      protocol.counter++;
    }

    await manager.save(ProtocolCounters, protocol);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(protocol.counter).padStart(7, '0');

    return `${year}${month}${seq}`;
  }
}
