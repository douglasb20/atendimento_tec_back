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
            name: 'module',
            type: 'varchar',
            length: '120',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
          },
        ]
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permissions');
  }
}
