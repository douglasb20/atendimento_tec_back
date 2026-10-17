import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissão do relatório analítico por cliente/contato (detalhe linha a
 * linha de um único cliente ou contato escolhido).
 *
 * Separada de `report.client:view` (o agregado) de propósito: o agregado
 * mostra só contagens e tempos por cliente, enquanto este expõe a conversa
 * individual - protocolo, horários, atendente de cada atendimento. Um grupo
 * pode ver o ranking sem poder abrir o detalhe de cada um.
 */
export class CreateClientDetailReportPermission1789950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (85, 'Ver relatório analítico por cliente', 20, 'report.client_detail:view');",
    );

    // Sem isto, quem administra hoje não enxerga a tela nova - o grupo
    // Administrador não ganha permissões novas automaticamente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 85 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 85;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 85;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 85;');
  }
}
