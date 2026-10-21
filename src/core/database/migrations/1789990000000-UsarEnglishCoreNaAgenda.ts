import { MigrationInterface, QueryRunner } from 'typeorm';

/** Converte a primeira base de agenda já aplicada para os nomes English Core. */
export class UsarEnglishCoreNaAgenda1789990000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.schedules') IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'titulo') THEN ALTER TABLE schedules RENAME COLUMN titulo TO title; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'observacao') THEN ALTER TABLE schedules RENAME COLUMN observacao TO description; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'inicio_em') THEN ALTER TABLE schedules RENAME COLUMN inicio_em TO starts_at; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'fim_em') THEN ALTER TABLE schedules RENAME COLUMN fim_em TO ends_at; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'lembrete_minutos') THEN ALTER TABLE schedules RENAME COLUMN lembrete_minutos TO reminder_minutes; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'schedules' AND constraint_name = 'schedules_intervalo_valido') THEN ALTER TABLE schedules RENAME CONSTRAINT schedules_intervalo_valido TO schedules_valid_interval; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'schedules' AND constraint_name = 'schedules_lembrete_valido') THEN ALTER TABLE schedules RENAME CONSTRAINT schedules_lembrete_valido TO schedules_valid_reminder; END IF;
          ALTER INDEX IF EXISTS idx_schedules_usuario_intervalo RENAME TO idx_schedules_user_interval;
          ALTER INDEX IF EXISTS idx_schedules_inicio RENAME TO idx_schedules_starts_at;
        END IF;

        IF to_regclass('public.notification') IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification' AND column_name = 'tipo') THEN ALTER TABLE notification RENAME COLUMN tipo TO type; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification' AND column_name = 'titulo') THEN ALTER TABLE notification RENAME COLUMN titulo TO title; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification' AND column_name = 'mensagem') THEN ALTER TABLE notification RENAME COLUMN mensagem TO message; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification' AND column_name = 'dados') THEN ALTER TABLE notification RENAME COLUMN dados TO data; END IF;
        END IF;

        IF to_regclass('public.notification_recipient') IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_recipient' AND column_name = 'lida') THEN ALTER TABLE notification_recipient RENAME COLUMN lida TO is_read; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notification_recipient' AND column_name = 'lida_em') THEN ALTER TABLE notification_recipient RENAME COLUMN lida_em TO read_at; END IF;
          ALTER INDEX IF EXISTS uq_notification_recipient_destinatario RENAME TO uq_notification_recipient_user;
          ALTER INDEX IF EXISTS idx_notification_recipient_nao_lidas RENAME TO idx_notification_recipient_unread;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.schedules') IS NOT NULL THEN
          ALTER INDEX IF EXISTS idx_schedules_starts_at RENAME TO idx_schedules_inicio;
          ALTER INDEX IF EXISTS idx_schedules_user_interval RENAME TO idx_schedules_usuario_intervalo;
          ALTER TABLE schedules RENAME CONSTRAINT schedules_valid_reminder TO schedules_lembrete_valido;
          ALTER TABLE schedules RENAME CONSTRAINT schedules_valid_interval TO schedules_intervalo_valido;
          ALTER TABLE schedules RENAME COLUMN reminder_minutes TO lembrete_minutos;
          ALTER TABLE schedules RENAME COLUMN ends_at TO fim_em;
          ALTER TABLE schedules RENAME COLUMN starts_at TO inicio_em;
          ALTER TABLE schedules RENAME COLUMN description TO observacao;
          ALTER TABLE schedules RENAME COLUMN title TO titulo;
        END IF;

        IF to_regclass('public.notification') IS NOT NULL THEN
          ALTER TABLE notification RENAME COLUMN data TO dados;
          ALTER TABLE notification RENAME COLUMN message TO mensagem;
          ALTER TABLE notification RENAME COLUMN title TO titulo;
          ALTER TABLE notification RENAME COLUMN type TO tipo;
        END IF;

        IF to_regclass('public.notification_recipient') IS NOT NULL THEN
          ALTER INDEX IF EXISTS idx_notification_recipient_unread RENAME TO idx_notification_recipient_nao_lidas;
          ALTER INDEX IF EXISTS uq_notification_recipient_user RENAME TO uq_notification_recipient_destinatario;
          ALTER TABLE notification_recipient RENAME COLUMN read_at TO lida_em;
          ALTER TABLE notification_recipient RENAME COLUMN is_read TO lida;
        END IF;
      END $$;
    `);
  }
}
