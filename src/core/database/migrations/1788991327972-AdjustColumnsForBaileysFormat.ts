import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajusta as colunas dimensionadas para o formato do whatsapp-web.js ao formato
 * do Baileys/Evolution.
 *
 * Os JIDs do Baileys são mais longos que os do WWeb.js e não caberiam em
 * varchar(20):
 *   554199999999@c.us            (WWeb.js)        -> 17 caracteres
 *   554199999999@s.whatsapp.net  (Baileys)        -> 27 caracteres
 *   120363000000000000@g.us      (grupo)          -> 23 caracteres
 *   554199999999-1234567890@g.us (grupo legado)   -> 28 caracteres
 *
 * Sem essa ampliação toda inserção de mensagem falharia por valor muito longo.
 */
export class AdjustColumnsForBaileysFormat1788991327972 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE support_chat_messages
      ALTER COLUMN "from" TYPE VARCHAR(60),
      ALTER COLUMN "to" TYPE VARCHAR(60),
      ALTER COLUMN message_id TYPE VARCHAR(100),
      ALTER COLUMN quoted_msg_id TYPE VARCHAR(100),
      ALTER COLUMN device_type DROP NOT NULL,
      ALTER COLUMN media_type TYPE VARCHAR(60);
    `);

    await queryRunner.query(`
      ALTER TABLE contacts
      ALTER COLUMN remote_jid TYPE VARCHAR(60);
    `);

    await queryRunner.query(`
      ALTER TABLE support_chats
      ALTER COLUMN last_message_id TYPE VARCHAR(100);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE support_chats
      ALTER COLUMN last_message_id TYPE VARCHAR(50);
    `);

    await queryRunner.query(`
      ALTER TABLE contacts
      ALTER COLUMN remote_jid TYPE VARCHAR(20);
    `);

    await queryRunner.query(`
      ALTER TABLE support_chat_messages
      ALTER COLUMN "from" TYPE VARCHAR(20),
      ALTER COLUMN "to" TYPE VARCHAR(20),
      ALTER COLUMN message_id TYPE VARCHAR(50),
      ALTER COLUMN quoted_msg_id TYPE VARCHAR(50),
      ALTER COLUMN device_type SET NOT NULL,
      ALTER COLUMN media_type TYPE VARCHAR(20);
    `);
  }
}
