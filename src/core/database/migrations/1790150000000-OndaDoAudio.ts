import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Onda da nota de voz: alturas de 0 a 100 (64 no WhatsApp), para app e portal
 * desenharem o balão sem baixar e decodificar o áudio. Vem do próprio WhatsApp
 * (recebidos) ou do gateway, que a calcula ao converter (enviados). Nula em
 * áudios antigos e de quem não manda a onda.
 */
export class OndaDoAudio1790150000000 implements MigrationInterface {
  private readonly coluna = new TableColumn({ name: 'waveform', type: 'jsonb', isNullable: true });

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn('support_chat_messages', this.coluna);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chat_messages', this.coluna.name);
  }
}
