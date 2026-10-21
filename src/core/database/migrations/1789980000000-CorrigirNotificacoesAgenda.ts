import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige a primeira versão da migration de agenda já aplicada em ambientes
 * locais: os nomes e o modelo passam a ser exatamente os da spec.
 *
 * Em instalações novas, a migration anterior já cria o modelo correto e os
 * blocos condicionais abaixo não têm efeito.
 */
export class CorrigirNotificacoesAgenda1789980000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.notifications') IS NOT NULL
          AND to_regclass('public.notification') IS NULL THEN
          ALTER TABLE notifications RENAME TO notification;
        END IF;

        IF to_regclass('public.notification_recipients') IS NOT NULL
          AND to_regclass('public.notification_recipient') IS NULL THEN
          ALTER TABLE notification_recipients RENAME TO notification_recipient;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'notification' AND column_name = 'corpo'
        ) THEN
          ALTER TABLE notification RENAME COLUMN corpo TO mensagem;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public' AND table_name = 'notification' AND constraint_name = 'notifications_schedule_fk'
        ) THEN
          ALTER TABLE notification DROP CONSTRAINT notifications_schedule_fk;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'notification' AND column_name = 'schedule_id'
        ) THEN
          ALTER TABLE notification DROP COLUMN schedule_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public' AND table_name = 'notification_recipient'
            AND constraint_name = 'notification_recipients_notification_fk'
        ) THEN
          ALTER TABLE notification_recipient RENAME CONSTRAINT notification_recipients_notification_fk
            TO notification_recipient_notification_fk;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public' AND table_name = 'notification_recipient'
            AND constraint_name = 'notification_recipients_user_fk'
        ) THEN
          ALTER TABLE notification_recipient RENAME CONSTRAINT notification_recipients_user_fk
            TO notification_recipient_user_fk;
        END IF;
      END $$;
    `);
    await queryRunner.query('ALTER INDEX IF EXISTS uq_notification_recipients_destinatario RENAME TO uq_notification_recipient_destinatario;');
    await queryRunner.query('ALTER INDEX IF EXISTS idx_notification_recipients_nao_lidas RENAME TO idx_notification_recipient_nao_lidas;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER INDEX IF EXISTS idx_notification_recipient_nao_lidas RENAME TO idx_notification_recipients_nao_lidas;');
    await queryRunner.query('ALTER INDEX IF EXISTS uq_notification_recipient_destinatario RENAME TO uq_notification_recipients_destinatario;');
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public' AND table_name = 'notification_recipient'
            AND constraint_name = 'notification_recipient_user_fk'
        ) THEN
          ALTER TABLE notification_recipient RENAME CONSTRAINT notification_recipient_user_fk
            TO notification_recipients_user_fk;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public' AND table_name = 'notification_recipient'
            AND constraint_name = 'notification_recipient_notification_fk'
        ) THEN
          ALTER TABLE notification_recipient RENAME CONSTRAINT notification_recipient_notification_fk
            TO notification_recipients_notification_fk;
        END IF;
      END $$;
    `);
    await queryRunner.query('ALTER TABLE notification ADD COLUMN schedule_id int;');
    await queryRunner.query('ALTER TABLE notification ADD CONSTRAINT notifications_schedule_fk FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE ON UPDATE CASCADE;');
    await queryRunner.query('ALTER TABLE notification RENAME COLUMN mensagem TO corpo;');
    await queryRunner.query('ALTER TABLE notification_recipient RENAME TO notification_recipients;');
    await queryRunner.query('ALTER TABLE notification RENAME TO notifications;');
  }
}
