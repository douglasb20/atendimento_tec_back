import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatbotPorCanal1790090000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE channels ADD COLUMN chatbot_habilitado boolean NOT NULL DEFAULT false');
    // Mantém em funcionamento os vínculos anteriores, inclusive os ainda em rascunho.
    await q.query(`UPDATE channels c SET chatbot_habilitado = true
      WHERE EXISTS (SELECT 1 FROM channel_x_chatbot cc JOIN chatbots b ON b.id = cc.chatbot_id
        WHERE cc.channel_id = c.id AND b.deleted_at IS NULL)`);
  }

  async down(q: QueryRunner): Promise<void> {
    const [desabilitado] = await q.query(`SELECT c.id FROM channels c WHERE NOT c.chatbot_habilitado
      AND EXISTS (SELECT 1 FROM channel_x_chatbot cc WHERE cc.channel_id = c.id) LIMIT 1`);
    if (desabilitado) throw new Error('Há canais com chatbot desabilitado e fluxos vinculados; reverta essa configuração antes da migration');
    await q.query('ALTER TABLE channels DROP COLUMN chatbot_habilitado');
  }
}
