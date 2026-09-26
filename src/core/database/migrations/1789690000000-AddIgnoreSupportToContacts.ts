import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Contato ignorado nunca entra em atendimento - a mensagem dele é descartada
 * já no webhook (`SupportChatsService.onMessageCreate`), antes de qualquer
 * `SupportChats`/`SupportChatMessages` ser criado. Sem histórico, sem
 * protocolo, sem saudação/aviso/chatbot - como se a mensagem nunca tivesse
 * chegado ao sistema.
 */
export class AddIgnoreSupportToContacts1789690000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'contacts',
      new TableColumn({
        name: 'ignore_support',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contacts', 'ignore_support');
  }
}
