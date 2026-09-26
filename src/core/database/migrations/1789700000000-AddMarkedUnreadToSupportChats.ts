import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * "Marcar como não lida" (ação manual do atendente) precisa de um sinal
 * próprio, distinto de `unread_count` - aquele é a contagem real de
 * mensagens do contato ainda não vistas, e o front usa o número dela no
 * badge. A marcação manual não tem "quantidade", é um lembrete visual (bolinha
 * sem número, como o WhatsApp Web) - misturar os dois em `unread_count`
 * deixaria o número errado (1) quando na verdade não há mensagem nova nenhuma.
 */
export class AddMarkedUnreadToSupportChats1789700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'support_chats',
      new TableColumn({
        name: 'marked_unread',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chats', 'marked_unread');
  }
}
