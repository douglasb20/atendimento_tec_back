import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissão para ver, na listagem, atendimentos já assumidos por outro
 * atendente. Sem ela, uma conversa em `EM_ANDAMENTO` com dono diferente do
 * usuário logado não aparece na lista - o que já está em espera/fila (sem
 * dono) continua visível para todos, sem essa permissão.
 */
export class CreateSupportChatViewOthersPermission1789720000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Permissão 80, no módulo 5 - mesmo domínio das demais `support.chat:*`
    // (17 view, 19 update, 50 transfer), sem precisar de módulo novo.
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (80, 'Ver conversas de outros atendentes', 5, 'support.chat:view_others');",
    );

    // Só o Administrador: enxergar o atendimento alheio é um privilégio de
    // supervisão, não o piso de qualquer atendente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 80 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 80;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 80;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 80;');
  }
}
