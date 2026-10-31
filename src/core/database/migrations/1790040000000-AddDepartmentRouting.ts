import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepartmentRouting1790040000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE channels ADD COLUMN default_department_id integer REFERENCES departments(id) ON DELETE SET NULL');
    await q.query('ALTER TABLE support_chat_events ADD COLUMN department_origem_id integer REFERENCES departments(id) ON DELETE SET NULL, ADD COLUMN department_destino_id integer REFERENCES departments(id) ON DELETE SET NULL');
    // Um único setor permite inferência segura para a configuração atual.
    await q.query(`UPDATE channels c SET default_department_id = v.setor FROM
      (SELECT channel_id, MIN(department_id) setor FROM channel_x_department GROUP BY channel_id HAVING COUNT(*) = 1) v
      WHERE c.id = v.channel_id`);
    await q.query(`UPDATE support_chats sc SET department_id = c.default_department_id FROM channels c, support_chat_status st
      WHERE c.id = sc.channel_id AND st.id = sc.support_chat_status_id AND NOT st.is_final
      AND sc.department_id IS NULL AND c.default_department_id IS NOT NULL`);
    await q.query("INSERT INTO permissions (id, label, permission_module_id, name) VALUES (95, 'Visualizar atendimentos de todos os setores', 5, 'support.chat:view_all_departments')");
    await q.query(`INSERT INTO permission_group_x_permission (permission_group_id, permission_id)
      SELECT id, 95 FROM permission_groups WHERE name = 'Administrador' ON CONFLICT DO NOTHING`);
    await q.query('CREATE INDEX support_chats_department_abertos_idx ON support_chats (department_id, support_chat_status_id)');
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX support_chats_department_abertos_idx');
    await q.query('DELETE FROM permission_group_x_permission WHERE permission_id = 95');
    await q.query('DELETE FROM permission_x_user WHERE permission_id = 95');
    await q.query('DELETE FROM permissions WHERE id = 95');
    await q.query('ALTER TABLE support_chat_events DROP COLUMN department_origem_id, DROP COLUMN department_destino_id');
    await q.query('ALTER TABLE channels DROP COLUMN default_department_id');
  }
}
