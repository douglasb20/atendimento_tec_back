import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateLogSistemaTable1739922407037 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'log_sistema',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'rota',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'ip',
            type: 'varchar',
            length: '40',
            isNullable: true,
            default: null,
          },
          {
            name: 'metodo',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'datetime_request',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'request_data',
            type: 'jsonb',
          },
          {
            name: 'queries',
            type: 'text',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('log_sistema');
  }
}
