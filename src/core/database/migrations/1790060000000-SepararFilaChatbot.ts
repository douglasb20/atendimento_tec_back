import { MigrationInterface, QueryRunner } from 'typeorm';

export class SepararFilaChatbot1790060000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE support_chat_status SET name = 'Em chatbot' WHERE id = 3");
    // Versões anteriores não devolviam a conversa após concluir o fluxo.
    await queryRunner.query(`UPDATE support_chats sc SET support_chat_status_id = 1
      WHERE sc.support_chat_status_id = 3 AND sc.user_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM chatbot_flow_executions e
        WHERE e.support_chat_id = sc.id AND e.status IN ('running', 'suspended'))`);
    // Uma execução antiga não pode retomar depois de atendimento humano/finalização.
    await queryRunner.query(`UPDATE chatbot_flow_executions e
      SET status = 'aborted', waiting_for = NULL, finished_at = NOW(), updated_at = NOW(), version = e.version + 1
      FROM support_chats sc WHERE sc.id = e.support_chat_id
      AND e.status IN ('running', 'suspended')
      AND (sc.support_chat_status_id <> 3 OR sc.user_id IS NOT NULL)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE support_chat_status SET name = 'Em fila' WHERE id = 3");
    // Não reativa automações nem desfaz encaminhamentos já realizados.
  }
}
