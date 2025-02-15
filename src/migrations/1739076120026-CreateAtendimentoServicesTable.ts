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
          },
          {
            name: 'id_atendimento',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'id_service',
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
            columnNames: ['id_atendimento'],
            referencedColumnNames: ['id'],
            referencedTableName: 'atendimentos',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'atendimentoservice_service_fk',
            columnNames: ['id_service'],
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
