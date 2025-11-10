import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

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
            name: 'client_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '90',
            isNullable: false,
          },
          {
            name: 'avatar_url',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_avatar_external',
            type: 'tinyint',
            length: '1',
            default: '0',
          },
          {
            name: 'tags',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '14',
            isNullable: true,
            default: null,
          },
          {
            name: 'remote_jid',
            type: 'varchar',
            length: '20',
            isNullable: true,
            default: null,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
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
        columnNames: ['client_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'clients',
        onDelete: 'RESTRICT',
        onUpdate: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'IDX_CONTACTS_CLIENT_ID',
        columnNames: ['client_id'],
      }),
    );

    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'IDX_CONTACTS_REMOTE_JID',
        columnNames: ['remote_jid'],
      }),
    );

    await queryRunner.createIndex(
      'contacts',
      new TableIndex({
        name: 'IDX_CONTACTS_STATUS',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('contacts', 'contacts_clients_fk');
    await queryRunner.dropTable('contacts');
  }
}
