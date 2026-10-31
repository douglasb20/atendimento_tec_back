import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConfigurarModuloChatbot1790070000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Preserva instalações que já possuem fluxos. Instalações novas começam desligadas.
    await queryRunner.query(`INSERT INTO attendance_settings (chave, valor)
      SELECT 'chatbot_habilitado', CASE WHEN EXISTS (
        SELECT 1 FROM chatbots WHERE deleted_at IS NULL
      ) THEN 'true' ELSE 'false' END ON CONFLICT (chave) DO NOTHING`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DELETE FROM attendance_settings WHERE chave = 'chatbot_habilitado'");
  }
}
