import { MigrationInterface, QueryRunner } from 'typeorm';

export class DesabilitarAutomacaoContato1790130000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE contacts ADD COLUMN automation_disabled boolean NOT NULL DEFAULT false');
  }

  async down(q: QueryRunner): Promise<void> {
    const [contato] = await q.query('SELECT id FROM contacts WHERE automation_disabled = true LIMIT 1');
    if (contato) throw new Error('Revise os contatos configurados como Somente humano antes de reverter esta migration');
    await q.query('ALTER TABLE contacts DROP COLUMN automation_disabled');
  }
}
