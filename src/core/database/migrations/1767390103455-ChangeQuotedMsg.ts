import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeQuotedMsg1767390103455 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE support_chat_messages
      ADD COLUMN has_quoted BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN quoted_msg_id VARCHAR(50),
      ADD COLUMN quoted_msg TEXT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('support_chat_messages', [
      'has_quoted',
      'quoted_msg_id',
      'quoted_msg',
    ]);
  }
}

