import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

import { Notifications } from '@/notifications/entities/notifications.entity';
import { NotificationRecipients } from '@/notifications/entities/notification-recipients.entity';
import { WhatsappGateway } from '@/whatsapp/whatsapp.gateway';

type LembretePendente = { id: number; title: string; starts_at: Date; user_id: number; reminder_minutes: number };

/** Gera uma única notificação persistente quando o compromisso entra na antecedência escolhida. */
@Injectable()
export class ScheduleRemindersService {
  private readonly logger = new Logger(ScheduleRemindersService.name);

  constructor(private readonly dataSource: DataSource, private readonly gateway: WhatsappGateway) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async verificar(): Promise<void> {
    // O lembrete fica amarrado ao `starts_at` vigente, comparado por epoch
    // (`to_timestamp(...) = s.starts_at`, não por igualdade de texto - o
    // formato do Postgres e o `toISOString()` do JS divergem): reagendar o
    // compromisso muda esse valor, então o `NOT EXISTS` deixa de achar a
    // notificação antiga e permite um novo lembrete para o novo horário. Sem
    // isso, editar a hora depois de já ter avisado uma vez silenciava o aviso
    // para sempre.
    const pendentes = await this.dataSource.query<LembretePendente[]>(`
      SELECT s.id, s.title, s.starts_at, s.user_id, s.reminder_minutes
      FROM schedules s
      WHERE s.starts_at > NOW()
        AND s.starts_at <= NOW() + (s.reminder_minutes * INTERVAL '1 minute')
        AND NOT EXISTS (
          SELECT 1 FROM notification n
          JOIN notification_recipient nr ON nr.notification_id = n.id
          WHERE n.type = 'schedule_reminder'
            AND nr.user_id = s.user_id
            AND n.data->>'schedule_id' = s.id::text
            AND to_timestamp((n.data->>'starts_at_epoch')::double precision) = s.starts_at
        )
    `);

    for (const compromisso of pendentes) await this.criar(compromisso);
  }

  private async criar(compromisso: LembretePendente): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const existe = await manager.query<{ existe: boolean }[]>(`
        SELECT EXISTS(
          SELECT 1 FROM notification n JOIN notification_recipient nr ON nr.notification_id = n.id
          WHERE n.type = 'schedule_reminder' AND nr.user_id = $1 AND n.data->>'schedule_id' = $2
            AND to_timestamp((n.data->>'starts_at_epoch')::double precision) = $3::timestamptz
        ) AS existe
      `, [compromisso.user_id, String(compromisso.id), compromisso.starts_at]);
      if (existe[0]?.existe) return;

      const notificacao = await manager.save(Notifications, manager.create(Notifications, {
        tipo: 'schedule_reminder',
        titulo: 'Lembrete de compromisso',
        mensagem: `Seu compromisso “${compromisso.title}” começa em ${compromisso.reminder_minutes} minuto(s).`,
        dados: { schedule_id: compromisso.id, starts_at_epoch: compromisso.starts_at.getTime() / 1000 },
      }));
      const destinatario = await manager.save(NotificationRecipients, manager.create(NotificationRecipients, {
        notification_id: notificacao.id,
        user_id: compromisso.user_id,
      }));
      this.gateway.emitToUser(compromisso.user_id, 'notificacao:recebida', { ...notificacao, destinatario_id: destinatario.id });
      this.logger.log(`Lembrete criado para o compromisso ${compromisso.id}.`);
    });
  }
}
