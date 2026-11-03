import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosAtendimentoMesmoProtocolo1790100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE support_chats ADD COLUMN pos_atendimento_ativo boolean NOT NULL DEFAULT false,
      ADD CONSTRAINT support_chats_pos_atendimento_finalizado CHECK (NOT pos_atendimento_ativo OR support_chat_status_id = 5)`);
    await q.query(`ALTER TABLE chatbot_flow_executions ADD COLUMN phase varchar(12) NOT NULL DEFAULT 'entrada',
      ADD CONSTRAINT chatbot_flow_executions_phase_check CHECK (phase IN ('entrada', 'saida'))`);
    await q.query("CREATE UNIQUE INDEX chatbot_saida_por_atendimento ON chatbot_flow_executions (support_chat_id) WHERE phase = 'saida'");
  }

  async down(q: QueryRunner): Promise<void> {
    const [pendente] = await q.query('SELECT id FROM support_chats WHERE pos_atendimento_ativo LIMIT 1');
    if (pendente) throw new Error('Conclua os pós-atendimentos antes de reverter esta migration');
    await q.query('DROP INDEX chatbot_saida_por_atendimento');
    await q.query('ALTER TABLE chatbot_flow_executions DROP CONSTRAINT chatbot_flow_executions_phase_check, DROP COLUMN phase');
    await q.query('ALTER TABLE support_chats DROP CONSTRAINT support_chats_pos_atendimento_finalizado, DROP COLUMN pos_atendimento_ativo');
  }
}
