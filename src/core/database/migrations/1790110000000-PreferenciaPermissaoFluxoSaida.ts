import { MigrationInterface, QueryRunner } from 'typeorm';

export class PreferenciaPermissaoFluxoSaida1790110000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // O comportamento anterior era iniciar marcado quando havia fluxo disponível.
    await q.query('ALTER TABLE channels ADD COLUMN chatbot_saida_por_padrao boolean NOT NULL DEFAULT true');
    await q.query('LOCK TABLE permissions IN EXCLUSIVE MODE');
    await q.query(`INSERT INTO permissions (id, label, permission_module_id, name)
      SELECT COALESCE(MAX(id), 0) + 1, 'Alterar execução do fluxo de saída', 5, 'support.chat:change_exit_flow'
      FROM permissions HAVING NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'support.chat:change_exit_flow')`);
    // Os seeds antigos usavam ids explícitos: não deixa o próximo cadastro colidir,
    // nem retrocede uma sequence que já esteja adiantada.
    await q.query(`SELECT setval(pg_get_serial_sequence('permissions', 'id'),
      GREATEST((SELECT MAX(id) FROM permissions), COALESCE(pg_sequence_last_value(pg_get_serial_sequence('permissions', 'id')::regclass), 1)), true)`);
    await q.query(`INSERT INTO permission_group_x_permission (permission_group_id, permission_id)
      SELECT g.id, p.id FROM permission_groups g CROSS JOIN permissions p
      WHERE g.name = 'Administrador' AND p.name = 'support.chat:change_exit_flow' ON CONFLICT DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM permission_group_x_permission WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'support.chat:change_exit_flow')");
    await q.query("DELETE FROM permission_x_user WHERE permission_id IN (SELECT id FROM permissions WHERE name = 'support.chat:change_exit_flow')");
    await q.query("DELETE FROM permissions WHERE name = 'support.chat:change_exit_flow'");
    await q.query('ALTER TABLE channels DROP COLUMN chatbot_saida_por_padrao');
  }
}
