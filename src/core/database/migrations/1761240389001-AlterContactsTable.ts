import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterContactsTable1761240389001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE contacts

      CHANGE COLUMN nome_contato name VARCHAR(90) NOT NULL,
      CHANGE COLUMN telefone_contato telefone VARCHAR(14) DEFAULT NULL AFTER name,
      CHANGE COLUMN client_id client_id INT NULL DEFAULT NULL,

      ADD COLUMN avatar_url TEXT AFTER name,
      ADD COLUMN tags VARCHAR(150) DEFAULT NULL AFTER avatar_url,
      ADD COLUMN remote_jid VARCHAR(20) NOT NULL AFTER telefone,
      ADD COLUMN updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE contacts
      DROP COLUMN avatar_url,
      DROP COLUMN tags,
      DROP COLUMN remote_jid,
      DROP COLUMN updated_at, 

      CHANGE COLUMN nome nome_contato VARCHAR(90) NOT NULL,
      CHANGE COLUMN telefone telefone_contato VARCHAR(14) DEFAULT NULL,
      CHANGE COLUMN client_id client_id INT NOT NULL;
    `);
  }
}
