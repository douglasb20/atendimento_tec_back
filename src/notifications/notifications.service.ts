import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { NotificationRecipients } from './entities/notification-recipients.entity';

@Injectable()
export class NotificationsService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(userId: number) {
    return this.dataSource.getRepository(NotificationRecipients).find({
      where: { user_id: userId }, relations: ['notificacao'], order: { created_at: 'DESC' }, take: 30,
    });
  }

  async marcarTodasComoLidas(userId: number) {
    await this.dataSource.getRepository(NotificationRecipients).update({ user_id: userId, lida: false }, { lida: true, lida_em: new Date() });
    return { atualizado: true };
  }

  async marcarComoLida(id: number, userId: number) {
    await this.dataSource.getRepository(NotificationRecipients).update({ id, user_id: userId, lida: false }, { lida: true, lida_em: new Date() });
    return { atualizado: true };
  }
}
