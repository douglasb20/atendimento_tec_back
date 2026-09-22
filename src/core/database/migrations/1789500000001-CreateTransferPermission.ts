import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissão de transferir atendimento.
 *
 * Entra no módulo 5 ("Atendimento-chat"), que já existe - é ação sobre a
 * conversa, não um domínio novo. Continua a numeração explícita das seeds:
 * `permissions` ia até 49 (campos personalizados).
 *
 * Permissão própria, e não o `support.chat:update` que as outras ações usam,
 * porque transferir é a única que tira a conversa das mãos de alguém: dá para
 * querer um atendente que responde e finaliza, mas não redistribui.
 */
export class CreateTransferPermission1789500000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (50, 'Transferir atendimento', 5, 'support.chat:transfer');",
    );

    // Sem isto quem já é administrador não enxergaria a ação, e a permissão
    // teria de ser marcada à mão em cada grupo existente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 50 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 50;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 50;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 50;');
  }
}
