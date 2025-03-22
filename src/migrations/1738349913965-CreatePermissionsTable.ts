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
            onUpdate: 'RESTRICT'
          }
        ]
      }),
    );
    if (await queryRunner.hasTable('permissions')) {
      await queryRunner.query(
        'INSERT INTO \
        permissions(label, module, name) \
        values("Visualizar usuário", "Usuário", "user:view"), \
        ("Cadastrar usuário", "Usuário", "user:add"), \
        ("Alterar usuário", "Usuário", "user:update"), \
        ("Deletar usuário", "Usuário", "user:delete"), \
        ',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permissions');
  }
}
