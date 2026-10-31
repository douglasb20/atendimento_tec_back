import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Distingue o atendimento encerrado por um nó do chatbot daquele descartado
 * manualmente sem resposta e daquele finalizado por inatividade.
 */
export class AddFinalizadoPeloChatbotStatus1790030000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO support_chat_status (id, name, is_final) VALUES (7, 'Finalizado pelo chatbot', true)",
    );

    // Execuções do nó já realizadas antes deste status existir deixaram a
    // mesma observação explícita. Preservamos a classificação correta delas.
    await queryRunner.query(
      "UPDATE support_chats SET support_chat_status_id = 7 WHERE support_chat_status_id = 4 AND observation_user = 'Finalizado pelo chatbot'",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'UPDATE support_chats SET support_chat_status_id = 4 WHERE support_chat_status_id = 7',
    );
    await queryRunner.query('DELETE FROM support_chat_status WHERE id = 7');
  }
}
