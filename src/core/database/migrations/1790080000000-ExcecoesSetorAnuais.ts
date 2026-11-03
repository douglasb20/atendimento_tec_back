import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExcecoesSetorAnuais1790080000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE department_schedule_exceptions ADD COLUMN recurring boolean NOT NULL DEFAULT false');
    await q.query('ALTER TABLE department_schedule_exceptions DROP CONSTRAINT department_schedule_exceptions_department_date_key');
    await q.query(`ALTER TABLE department_schedule_exceptions
      ADD CONSTRAINT department_schedule_exceptions_department_date_recurrence_key UNIQUE (department_id, date, recurring),
      ADD CONSTRAINT department_schedule_exceptions_annual_reference_check CHECK (NOT recurring OR EXTRACT(YEAR FROM date) = 2000)`);
  }

  async down(q: QueryRunner): Promise<void> {
    const [anual] = await q.query('SELECT id FROM department_schedule_exceptions WHERE recurring = true LIMIT 1');
    if (anual) throw new Error('Converta ou remova as exceções anuais antes de reverter esta migration');
    await q.query(`ALTER TABLE department_schedule_exceptions
      DROP CONSTRAINT department_schedule_exceptions_annual_reference_check,
      DROP CONSTRAINT department_schedule_exceptions_department_date_recurrence_key,
      ADD CONSTRAINT department_schedule_exceptions_department_date_key UNIQUE (department_id, date),
      DROP COLUMN recurring`);
  }
}
