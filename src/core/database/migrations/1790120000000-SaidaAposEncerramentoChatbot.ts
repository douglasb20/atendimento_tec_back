import { MigrationInterface, QueryRunner } from 'typeorm';

export class SaidaAposEncerramentoChatbot1790120000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE support_chats DROP CONSTRAINT support_chats_pos_atendimento_finalizado,
      ADD CONSTRAINT support_chats_pos_atendimento_finalizado CHECK (NOT pos_atendimento_ativo OR support_chat_status_id IN (5, 7))`);
  }

  async down(q: QueryRunner): Promise<void> {
    const [pendente] = await q.query('SELECT id FROM support_chats WHERE pos_atendimento_ativo AND support_chat_status_id = 7 LIMIT 1');
    if (pendente) throw new Error('Conclua os pós-atendimentos iniciados pelo chatbot antes de reverter esta migration');
    await q.query(`ALTER TABLE support_chats DROP CONSTRAINT support_chats_pos_atendimento_finalizado,
      ADD CONSTRAINT support_chats_pos_atendimento_finalizado CHECK (NOT pos_atendimento_ativo OR support_chat_status_id = 5)`);
  }
}
