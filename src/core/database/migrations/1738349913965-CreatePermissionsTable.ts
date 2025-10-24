import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePermissionsTable1738349913965 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'label',
            type: 'varchar',
            length: '90',
          },
          {
            name: 'permission_module_id',
            type: 'int',
            length: '11',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
          },
        ],
        foreignKeys: [
          {
            name: 'permission_permission_module_fk',
            columnNames: ['permission_module_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'permission_module',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
        ],
      }),
    );
    if (await queryRunner.hasTable('permissions')) {
      await queryRunner.query(
        "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
                (1, 'Alterar Atendimento', 1, 'atendimento:update'), \
                (2, 'Adicionar Atendimento', 1, 'atendimento:add'), \
                (3, 'Visualizar Atendimento', 1, 'atendimento:view'), \
                (4, 'Remover Atendimento', 1, 'atendimento:delete'), \
                (5, 'Visualizar usuário', 2, 'user:view'), \
                (6, 'Cadastrar usuário', 2, 'user:add'), \
                (7, 'Alterar usuário', 2, 'user:update'), \
                (8, 'Remover usuário', 2, 'user:delete'), \
                (9, 'Adicionar serviço', 3, 'service:add'), \
                (10, 'Atualizar serviço', 3, 'service:update');",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permissions');
  }
}
