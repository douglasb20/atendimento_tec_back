import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissões do cadastro de etiquetas.
 *
 * Continua a numeração explícita das seeds existentes: `permission_module` ia
 * até 9 (Integrações) e `permissions` até 34.
 */
export class CreateTagPermissions1789460000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("INSERT INTO permission_module(id, nome) VALUES (10,'Etiquetas');");

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (35, 'Visualizar etiquetas', 10, 'tag:view'), \
      (36, 'Adicionar etiqueta', 10, 'tag:add'), \
      (37, 'Atualizar etiqueta', 10, 'tag:update'), \
      (38, 'Remover etiqueta', 10, 'tag:delete');",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 35 AND 38;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 35 AND 38;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 10;');
  }
}
