import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissões do catálogo de campos personalizados.
 *
 * Continua a numeração explícita das seeds existentes: `permission_module` ia
 * até 12 e `permissions` até 45.
 *
 * Só o catálogo tem permissão própria. Preencher os valores num contato usa
 * `contact:update`, e num cliente `client:update` — é edição do cadastro, não
 * uma ação à parte; exigir permissão separada faria alguém poder editar o
 * contato mas não um dos campos dele.
 */
export class CreateCustomFieldPermissions1789490000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permission_module(id, nome) VALUES (13,'Campos personalizados');",
    );

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (46, 'Visualizar campos personalizados', 13, 'custom.field:view'), \
      (47, 'Adicionar campo personalizado', 13, 'custom.field:add'), \
      (48, 'Atualizar campo personalizado', 13, 'custom.field:update'), \
      (49, 'Remover campo personalizado', 13, 'custom.field:delete');",
    );

    // O grupo Administrador recebe as novas, como recebeu todas as anteriores:
    // sem isto quem já é administrador não enxergaria a tela, e a permissão
    // teria de ser marcada à mão em cada grupo existente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id BETWEEN 46 AND 49 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 46 AND 49;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 46 AND 49;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 46 AND 49;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 13;');
  }
}
