import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAtendimentosTable1726357566010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'atendimentos',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'clients_id',
            type: 'int',
          },
          {
            name: 'contacts_id',
            type: 'int',
            isNullable: true,
            default: null
          },
          {
            name: 'users_id',
            type: 'int',
          },
          {
            name: 'data_referencia',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'hora_inicio',
            type: 'time',
            isNullable: false,
          },
          {
            name: 'hora_fim',
            type: 'time',
            isNullable: false,
          },
          {
            name: 'comentario',
            type: 'text',
            isNullable: true,
            default: null,
          },
          {
            name: 'tipo_entrada',
            type: 'char',
            length: '1',
          },
          {
            name: 'atendimento_status_id',
            type: 'int',
          },
        ],
        foreignKeys: [
          {
            name: 'atendimentos_clients_fk',
            columnNames: ['clients_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'clients',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'atendimentos_contacts_fk',
            columnNames: ['contacts_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'contacts',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'atendimentos_users_fk',
            columnNames: ['users_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'atendimentos_status_fk',
            columnNames: ['atendimento_status_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'atendimento_status',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('atendimentos');
  }
}
