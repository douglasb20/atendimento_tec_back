import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Base persistente da agenda.
 *
 * A agenda não reutiliza atendimento nem chat: um compromisso pode nascer sem
 * conversa, sem contato e até antes de o cliente existir. As notificações
 * também são genéricas para poderem servir a eventos futuros sem duplicar o
 * histórico por destinatário.
 */
export class CreateSchedulesBase1789970000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'schedules',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'title', type: 'varchar', length: '160', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'starts_at', type: 'timestamptz', isNullable: false },
          { name: 'ends_at', type: 'timestamptz', isNullable: false },
          // Conjunto inicial definido na spec: 10 min, 30 min ou 1 h.
          { name: 'reminder_minutes', type: 'smallint', isNullable: false, default: '30' },
          { name: 'user_id', type: 'int', isNullable: false },
          { name: 'client_id', type: 'int', isNullable: true },
          { name: 'contact_id', type: 'int', isNullable: true },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'schedules_user_fk', columnNames: ['user_id'], referencedTableName: 'users',
            referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE',
          },
          {
            name: 'schedules_client_fk', columnNames: ['client_id'], referencedTableName: 'clients',
            referencedColumnNames: ['id'], onDelete: 'SET NULL', onUpdate: 'CASCADE',
          },
          {
            name: 'schedules_contact_fk', columnNames: ['contact_id'], referencedTableName: 'contacts',
            referencedColumnNames: ['id'], onDelete: 'SET NULL', onUpdate: 'CASCADE',
          },
        ],
        checks: [
          { name: 'schedules_valid_interval', expression: 'ends_at > starts_at' },
          { name: 'schedules_valid_reminder', expression: 'reminder_minutes IN (5, 10, 15, 20, 25, 30, 60)' },
        ],
      }),
      true,
    );

    // Lista por responsável e intervalo; também é a consulta do job de lembrete.
    await queryRunner.query('CREATE INDEX idx_schedules_user_interval ON schedules (user_id, starts_at, ends_at);');
    await queryRunner.query('CREATE INDEX idx_schedules_starts_at ON schedules (starts_at);');

    await queryRunner.createTable(
      new Table({
        name: 'notification',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'type', type: 'varchar', length: '60', isNullable: false },
          { name: 'title', type: 'varchar', length: '160', isNullable: false },
          { name: 'message', type: 'text', isNullable: false },
          { name: 'data', type: 'jsonb', isNullable: true },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'notification_recipient',
        columns: [
          { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'notification_id', type: 'int', isNullable: false },
          { name: 'user_id', type: 'int', isNullable: false },
          { name: 'is_read', type: 'boolean', isNullable: false, default: false },
          { name: 'read_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', isNullable: false, default: 'now()' },
        ],
        foreignKeys: [
          {
            name: 'notification_recipient_notification_fk', columnNames: ['notification_id'],
            referencedTableName: 'notification', referencedColumnNames: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE',
          },
          {
            name: 'notification_recipient_user_fk', columnNames: ['user_id'],
            referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );
    await queryRunner.query('CREATE UNIQUE INDEX uq_notification_recipient_user ON notification_recipient (notification_id, user_id);');
    await queryRunner.query('CREATE INDEX idx_notification_recipient_unread ON notification_recipient (user_id, created_at DESC) WHERE is_read = false;');

    // Cada atendente tem uma cor exclusiva. Os cadastros já existentes recebem
    // as primeiras cores da paleta fixa; mais de 24 usuários exige ampliar a
    // paleta conscientemente, como definido na spec.
    await queryRunner.query("ALTER TABLE users ADD COLUMN schedule_color varchar(7);");
    await queryRunner.query(`
      WITH ordenados AS (
        SELECT id, row_number() OVER (ORDER BY id) AS posicao FROM users
      ), paleta AS (
        SELECT ARRAY[
          '#EF4444','#3B82F6','#F59E0B','#22C55E','#8B5CF6','#EC4899',
          '#06B6D4','#F97316','#84CC16','#6366F1','#D946EF','#0F766E',
          '#F43F5E','#EAB308','#10B981','#A855F7','#0EA5E9','#0369A1',
          '#BE123C','#14B8A6','#78716C','#4338CA','#7E22CE','#64748B'
        ] AS cores
      )
      UPDATE users u SET schedule_color = paleta.cores[ordenados.posicao]
      FROM ordenados CROSS JOIN paleta
      WHERE u.id = ordenados.id AND ordenados.posicao <= cardinality(paleta.cores);
    `);
    await queryRunner.query('ALTER TABLE users ALTER COLUMN schedule_color SET NOT NULL;');
    await queryRunner.query('ALTER TABLE users ADD CONSTRAINT uq_users_schedule_color UNIQUE (schedule_color);');

    await queryRunner.query("INSERT INTO permission_module (id, nome) VALUES (21, 'Agenda');");
    await queryRunner.query(`
      INSERT INTO permissions (id, label, permission_module_id, name) VALUES
        (87, 'Visualizar agenda', 21, 'schedule:view'),
        (88, 'Adicionar compromisso', 21, 'schedule:add'),
        (89, 'Alterar compromisso', 21, 'schedule:edit'),
        (90, 'Remover compromisso', 21, 'schedule:delete');
    `);
    await queryRunner.query(`
      INSERT INTO permission_group_x_permission (permission_group_id, permission_id)
      SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p
      WHERE pg.name = 'Administrador' AND p.id BETWEEN 87 AND 90
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 87 AND 90;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 87 AND 90;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 87 AND 90;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 21;');

    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT uq_users_schedule_color;');
    await queryRunner.query('ALTER TABLE users DROP COLUMN schedule_color;');
    await queryRunner.dropTable('notification_recipient', true);
    await queryRunner.dropTable('notification', true);
    await queryRunner.dropTable('schedules', true);
  }
}
