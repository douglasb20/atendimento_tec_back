import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAtendimentoServicesTable1739076120026 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'atendimento_servicos',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
            unsigned: true
          },
          {
            name: 'atendimento_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'service_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'valor_cobrado',
            type: 'decimal',
            length: '5,2',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            name: 'atendimentoservice_atendimento_fk',
            columnNames: ['atendimento_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'atendimentos',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'atendimentoservice_service_fk',
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
    await queryRunner.dropTable('atendimento_servicos');
  }
}
