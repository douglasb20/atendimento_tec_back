import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSupportServicesTable1739076120026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'support_services',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'support_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'service_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'service_fee',
            type: 'decimal',
            length: '5,2',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            name: 'supportservices_support_fk',
            columnNames: ['support_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'supports',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'supportservices_service_fk',
            columnNames: ['service_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'services',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('support_services');
  }
}
