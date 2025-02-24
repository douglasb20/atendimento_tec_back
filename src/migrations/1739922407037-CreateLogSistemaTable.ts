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
            unsigned: true,
          },
          {
            name: 'rota',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'id_usuario',
            type: 'int',
          },
          {
            name: 'metodo',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'datetime_request',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'request_data',
            type: 'json',
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
