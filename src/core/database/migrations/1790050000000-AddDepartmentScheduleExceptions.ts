import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepartmentScheduleExceptions1790050000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE departments ADD COLUMN respect_holidays boolean NOT NULL DEFAULT false');
    await q.query(`CREATE TABLE department_schedule_exceptions (
      id SERIAL PRIMARY KEY,
      department_id integer NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      date date NOT NULL,
      description varchar(120) NOT NULL,
      mode varchar(12) NOT NULL CHECK (mode IN ('fechado', 'normal', 'especial')),
      intervals jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(intervals) = 'array'),
      holiday_id integer REFERENCES holidays(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT department_schedule_exceptions_department_date_key UNIQUE (department_id, date)
    )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE department_schedule_exceptions');
    await q.query('ALTER TABLE departments DROP COLUMN respect_holidays');
  }
}
