import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePermissionModuleTable1738349913964 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permission_module',
        columns: [
          {
            name: 'id',
            type: 'int',
            isGenerated: true,
            isPrimary: true,
            generationStrategy: 'increment',
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '60',
          },
        ],
      }),
      true,
    );

    const hasTable = await queryRunner.hasTable('permission_module');
    if (hasTable) {
      await queryRunner.query(
        "INSERT INTO permission_module(id, nome) values \
        (1,'Atendimento'), \
        (2,'Usuário'), \
        (3,'Serviços'), \
        (4,'Canais'), \
        (5,'Atendimento-chat'), \
        (6,'Mensagens');",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permission_module');
  }
}
