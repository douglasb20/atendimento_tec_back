import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateChannelsTable1761251488012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'channels',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'phone_number',
            type: 'varchar',
            length: '20',
            isNullable: true,
            default: null,
          },
          {
            name: 'session_id',
            type: 'char',
            length: '36',
            isNullable: true,
            default: null,
          },
          {
            name: 'channel_status_id',
            type: 'int',
            isNullable: false,
            default: '1',
          },
          {
            name: 'qr_code',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'connected_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'disconnected_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
            default: null,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_channel_status_id_channels',
            columnNames: ['channel_status_id'],
            referencedTableName: 'channel_status',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('channels', 'fk_channel_status_id_channels');
    await queryRunner.dropTable('channels');
  }
}
