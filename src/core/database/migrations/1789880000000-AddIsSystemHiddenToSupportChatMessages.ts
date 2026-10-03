import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Mensagem que o sistema enviou mas **nunca** deve aparecer na conversa.
 *
 * Hoje só a rejeição automática de chamada: o texto precisa chegar ao cliente,
 * mas repeti-lo na conversa a cada ligação poluiria o histórico - o atendente
 * vê o evento "chamada rejeitada" e nada mais.
 *
 * Distinto de `hidden_at`, que é o "apagar para mim" do atendente e deixa na
 * tela o marcador "Mensagem removida do sistema": aqui não há marcador nenhum,
 * a linha some da consulta.
 */
export class AddIsSystemHiddenToSupportChatMessages1789880000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'support_chat_messages',
      new TableColumn({
        name: 'is_system_hidden',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chat_messages', 'is_system_hidden');
  }
}
