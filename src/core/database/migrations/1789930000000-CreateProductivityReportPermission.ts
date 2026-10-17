import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissão do relatório de produtividade por atendente.
 *
 * Segunda do módulo "Relatórios" (criado em `CreateReportsPermissions`, id
 * 20) - uma permissão por relatório, não uma só para o módulo: aqui o dado é
 * de supervisão (quanto cada atendente produziu), e pode caber a um grupo que
 * não vê o relatório operacional de atendimentos, ou o contrário.
 */
export class CreateProductivityReportPermission1789930000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (83, 'Ver relatório de produtividade', 20, 'report.productivity:view');",
    );

    // Sem isto, quem administra hoje não enxerga a tela nova - o grupo
    // Administrador não ganha permissões novas automaticamente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 83 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 83;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 83;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 83;');
  }
}
