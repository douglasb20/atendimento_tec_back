import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSupportChatsTable1761251493663 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'support_chats',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            unsigned: true,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'channel_id',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'contact_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'support_chat_status_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'protocol',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'unread_count',
            type: 'int',
            length: '3',
            default: '0',
          },
          {
            name: 'last_message',
            type: 'text',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_message_type',
            type: 'varchar',
            length: '45',
            isNullable: true,
            default: null,
          },
          {
            name: 'last_message_id',
            type: 'varchar',
            length: '50',
            isNullable: true,
            default: null,
          },
          {
            name: 'is_waiting',
            type: 'tinyint',
            length: '1',
            default: '1',
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'answered_at',
            type: 'datetime',
            isNullable: true,
            default: null,
          },
          {
            name: 'finished_at',
            type: 'datetime',
            isNullable: true,
            default: null,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            isNullable: true,
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'observation_user',
            type: 'text',
            isNullable: true,
            default: null,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_users_id_support_chats',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'fk_channels_id_support_chats',
            columnNames: ['channel_id'],
            referencedTableName: 'channels',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'fk_contacts_id_support_chats',
            columnNames: ['contact_id'],
            referencedTableName: 'contacts',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
          {
            name: 'fk_support_chat_status_id_support_chats',
            columnNames: ['support_chat_status_id'],
            referencedTableName: 'support_chat_status',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
        ],
        indices: [
          {
            name: 'IDX_SUPPORT_CHATS_USER_ID',
            columnNames: ['user_id'],
          },
          {
            name: 'IDX_SUPPORT_CHATS_CHANNEL_ID',
            columnNames: ['channel_id'],
          },
          {
            name: 'IDX_SUPPORT_CHATS_CONTACT_ID',
            columnNames: ['contact_id'],
          },
          {
            name: 'IDX_SUPPORT_CHATS_STATUS_ID',
            columnNames: ['support_chat_status_id'],
          },
          {
            name: 'IDX_SUPPORT_CHATS_PROTOCOL',
            columnNames: ['protocol'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('support_chats', 'fk_users_id_support_chats');
    await queryRunner.dropForeignKey('support_chats', 'fk_channels_id_support_chats');
    await queryRunner.dropForeignKey('support_chats', 'fk_contacts_id_support_chats');
    await queryRunner.dropForeignKey('support_chats', 'fk_support_chat_status_id_support_chats');
    await queryRunner.dropTable('support_chats');
  }
}
