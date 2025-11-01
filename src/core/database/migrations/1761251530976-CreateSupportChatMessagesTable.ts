import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSupportChatMessagesTable1761251530976 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'support_chat_messages',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'support_chat_id',
            type: 'bigint',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'channel_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'message_id',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'datetime',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'ack',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'from_me',
            type: 'tinyint',
            length: '1',
            isNullable: false,
          },
          {
            name: 'content',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'has_media',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: '0',
          },
          {
            name: 'media_url',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'media_type',
            type: 'varchar',
            length: '15',
            isNullable: true,
          },
          {
            name: 'from',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'to',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'is_deleted',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: '0',
          },
          {
            name: 'is_edited',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: '0',
          },
          {
            name: 'has_reaction',
            type: 'tinyint',
            length: '1',
            isNullable: false,
            default: '0',
          },
          {
            name: 'reaction',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: '0',
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'fk_support_chat_id_support_chat_messages',
            columnNames: ['support_chat_id'],
            referencedTableName: 'support_chats',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'fk_channels_id_support_chat_messages',
            columnNames: ['channel_id'],
            referencedTableName: 'channels',
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
    await queryRunner.dropForeignKey(
      'support_chat_messages',
      'fk_support_chat_id_support_chat_messages',
    );
    await queryRunner.dropForeignKey(
      'support_chat_messages',
      'fk_channels_id_support_chat_messages',
    );
    await queryRunner.dropTable('support_chat_messages');
  }
}
