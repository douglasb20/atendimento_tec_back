import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePermissionModuleTable1738352257563 implements MigrationInterface {
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
            generationStrategy: 'increment'
          },
          {
            name: 'nome',
            type: 'varchar',
            length: '60'
          }
        ]
      }
      ), true
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permission_module')
  }
}
