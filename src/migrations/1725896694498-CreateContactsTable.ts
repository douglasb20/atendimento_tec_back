import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateContactsTable1725896694498 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'contacts',
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
            length: '11',
            isNullable: false,
          },
          {
            name: 'nome_contato',
            type: 'varchar',
            length: '90',
            isNullable: false,
          },
          {
            name: 'telefone_contato',
            type: 'varchar',
            length: '14',
            isNullable: true,
            default: null,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'status',
            type: 'tinyint',
            length: '1',
            default: '1',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'contacts',
      new TableForeignKey({
        name: 'contacts_clients_fk',
        columnNames: ['clients_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'clients',
        onDelete: 'SET NULL',
        onUpdate: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('contacts', 'contacts_clients_fk');
    await queryRunner.dropTable('contacts');
  }
}
