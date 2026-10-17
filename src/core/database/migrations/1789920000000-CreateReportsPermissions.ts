import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Módulo de permissões "Relatórios" e a primeira delas, a de atendimentos.
 *
 * **Uma permissão por relatório**, e não uma única `report:view` para o
 * módulo inteiro: decisão do usuário, porque um relatório pode ser visível a
 * um grupo e não a outro - produtividade por atendente, por exemplo, é dado
 * de supervisão, enquanto o de atendimentos é operacional.
 *
 * As outras duas (`report.productivity:view`, `report.sla:view`) entram em
 * migrations próprias quando esses relatórios forem implementados; criar
 * permissão para tela que não existe só confunde quem monta um grupo.
 */
export class CreateReportsPermissions1789920000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Módulo 20: nenhum dos 19 existentes serve - relatório não é
    // "Atendimentos" (que é a operação do chat) nem "Configurações".
    await queryRunner.query(
      "INSERT INTO permission_module (id, nome) VALUES (20, 'Relatórios');",
    );

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (82, 'Ver relatório de atendimentos', 20, 'report.attendance:view');",
    );

    // Sem isto, quem administra hoje não enxerga a tela nova - o grupo
    // Administrador não ganha permissões novas automaticamente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 82 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Nesta ordem: as FKs são RESTRICT, e o módulo só sai depois da
    // permissão que o referencia.
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 82;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 82;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 82;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 20;');
  }
}
