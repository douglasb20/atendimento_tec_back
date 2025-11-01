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
                (1, 'Visualizar Support', 1, 'support:view'), \
                (2, 'Adicionar Support', 1, 'support:add'), \
                (3, 'Alterar Support', 1, 'support:update'), \
                (4, 'Remover Support', 1, 'support:delete'), \
                (5, 'Visualizar usuário', 2, 'user:view'), \
                (6, 'Adicionar usuário', 2, 'user:add'), \
                (7, 'Alterar usuário', 2, 'user:update'), \
                (8, 'Remover usuário', 2, 'user:delete'), \
                (9, 'Visualizar serviço', 3, 'service:view'), \
                (10, 'Adicionar serviço', 3, 'service:add'), \
                (11, 'Atualizar serviço', 3, 'service:update'), \
                (12, 'Remover serviço', 3, 'service:delete'), \
                (13, 'Visualizar canal', 4, 'channel:view'), \
                (14, 'Adicionar canal', 4, 'channel:add'), \
                (15, 'Atualizar canal', 4, 'channel:update'), \
                (16, 'Remover canal', 4, 'channel:delete'), \
                (17, 'Visualizar atendimento-chat', 5, 'support.chat:view'), \
                (18, 'Adicionar atendimento-chat', 5, 'support.chat:add'), \
                (19, 'Atualizar atendimento-chat', 5, 'support.chat:update'), \
                (20, 'Remover atendimento-chat', 5, 'support.chat:delete'), \
                (21, 'Visualizar mensagens', 5, 'message:view'), \
                (22, 'Adicionar mensagens', 5, 'message:add'), \
                (23, 'Atualizar mensagens', 5, 'message:update'), \
                (24, 'Remover mensagens', 5, 'message:delete');",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permissions');
  }
}
