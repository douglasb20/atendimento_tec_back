import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nome original do arquivo enviado ou recebido.
 *
 * O campo já circulava pelo DTO de envio e pelo front, mas nunca teve coluna:
 * era repassado ao provider - por isso o destinatário via o nome certo no
 * WhatsApp - e descartado em seguida. Na nossa conversa o documento aparecia
 * como "Documento", sem identificar qual arquivo era.
 *
 * 255 acompanha `media_url`; nomes maiores que isso são truncados pelo próprio
 * sistema de arquivos de origem muito antes de chegarem aqui.
 */
export class AddFileNameToMessages1789160000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE support_chat_messages
      ADD COLUMN file_name VARCHAR(255) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chat_messages', 'file_name');
  }
}
