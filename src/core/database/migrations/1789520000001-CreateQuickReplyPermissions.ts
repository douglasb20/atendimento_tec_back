import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissões do cadastro de respostas rápidas.
 *
 * Continua a numeração explícita das seeds: `permission_module` ia até 13
 * (Campos personalizados) e `permissions` até 50 (transferir atendimento).
 *
 * Só o **cadastro** tem permissão. Usar uma resposta rápida na conversa é
 * responder ao cliente, e já exige `support.chat:update` - exigir outra faria
 * um atendente poder escrever à mão o que não pode inserir pronto.
 */
export class CreateQuickReplyPermissions1789520000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permission_module(id, nome) VALUES (14,'Respostas rápidas');",
    );

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (51, 'Visualizar respostas rápidas', 14, 'quick.reply:view'), \
      (52, 'Adicionar resposta rápida', 14, 'quick.reply:add'), \
      (53, 'Atualizar resposta rápida', 14, 'quick.reply:update'), \
      (54, 'Remover resposta rápida', 14, 'quick.reply:delete');",
    );

    // Sem isto quem já é administrador não enxergaria a tela, e a permissão
    // teria de ser marcada à mão em cada grupo existente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id BETWEEN 51 AND 54 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 51 AND 54;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 51 AND 54;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 51 AND 54;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 14;');
  }
}
