import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissão do relatório por cliente/contato.
 *
 * Terceira do módulo "Relatórios" (criado em `CreateReportsPermissions`, id
 * 20) - uma permissão por relatório, pelo mesmo motivo das outras duas: este
 * é dado comercial (quem consome mais atendimento), e pode caber a um grupo
 * que não vê produtividade por atendente, ou o contrário.
 */
export class CreateClientReportPermission1789940000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (84, 'Ver relatório por cliente', 20, 'report.client:view');",
    );

    // Sem isto, quem administra hoje não enxerga a tela nova - o grupo
    // Administrador não ganha permissões novas automaticamente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 84 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 84;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 84;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 84;');
  }
}
