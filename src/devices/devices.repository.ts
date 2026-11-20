import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { UserDevices } from './entities/user-devices.entity';

@Injectable()
export class DevicesRepository extends Repository<UserDevices> {
  constructor(protected dataSource: DataSource) {
    super(UserDevices, dataSource.manager);
  }

  /** Celulares de usuários ativos (`status = 1`): inativo não recebe aviso. */
  async ativos(): Promise<{ user_id: number; token: string }[]> {
    const linhas: { user_id: number; token: string }[] = await this.dataSource.query(
      'SELECT d.user_id, d.token FROM user_devices d JOIN users u ON u.id = d.user_id WHERE u.status = 1',
    );
    return linhas.map((l) => ({ user_id: Number(l.user_id), token: l.token }));
  }
}
