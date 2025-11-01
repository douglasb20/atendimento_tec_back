import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSupportsTable1726357566010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'supports',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'client_id',
            type: 'int',
          },
          {
            name: 'contact_id',
            type: 'int',
            isNullable: true,
            default: null,
          },
          {
            name: 'user_id',
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
            name: 'support_status_id',
            type: 'int',
          },
        ],
        foreignKeys: [
          {
            name: 'supports_clients_fk',
            columnNames: ['client_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'clients',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'supports_contacts_fk',
            columnNames: ['contact_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'contacts',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'supports_users_fk',
            columnNames: ['user_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'supports_status_fk',
            columnNames: ['support_status_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'support_status',
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
        ],
        indices: [
          {
            name: 'data_referencia_idx',
            columnNames: ['data_referencia'],
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('supports');
  }
}
