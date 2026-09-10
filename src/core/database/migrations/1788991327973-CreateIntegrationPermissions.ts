import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntegrationPermissions1788991327973 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Continua a numeração explícita das seeds existentes:
    // permission_module vai até 8, permissions até 30.
    await queryRunner.query("INSERT INTO permission_module(id, nome) VALUES (9,'Integrações');");

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (31, 'Visualizar integrações', 9, 'integration:view'), \
      (32, 'Adicionar integração', 9, 'integration:add'), \
      (33, 'Atualizar integração', 9, 'integration:update'), \
      (34, 'Remover integração', 9, 'integration:delete');",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 31 AND 34;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 31 AND 34;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 9;');
  }
}
