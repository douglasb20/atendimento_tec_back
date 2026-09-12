import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca mensagens cuja mídia foi removida do storage pela política de retenção.
 *
 * É diferente de `is_deleted`: ali a mensagem foi revogada pelo contato no
 * WhatsApp e o conteúdo deixou de valer. Aqui a mensagem continua íntegra
 * (legenda, data, autor) - apenas o arquivo não está mais disponível, e o front
 * deve exibir "mídia expirada" em vez de "mensagem apagada".
 */
export class AddMediaExpiredToMessages1788997359560 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE support_chat_messages
      ADD COLUMN media_expired BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN media_expired_at TIMESTAMP NULL;
    `);

    // A varredura busca mídia antiga ainda não expirada.
    await queryRunner.query(`
      CREATE INDEX idx_messages_media_retencao
      ON support_chat_messages (created_at)
      WHERE has_media = true AND media_expired = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_messages_media_retencao;');
    await queryRunner.dropColumns('support_chat_messages', ['media_expired', 'media_expired_at']);
  }
}
