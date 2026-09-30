import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsAutomaticToSupportChatMessages1789830000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'support_chat_messages',
      new TableColumn({
        name: 'is_automatic',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chat_messages', 'is_automatic');
  }
}
