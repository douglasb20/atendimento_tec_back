import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Marca a mensagem recebida como encaminhada (`contextInfo.isForwarded`), só
 * para identificação na tela - como o WhatsApp oficial faz.
 */
export class AddIsForwardedToSupportChatMessages1789860000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'support_chat_messages',
      new TableColumn({ name: 'is_forwarded', type: 'boolean', isNullable: false, default: false }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chat_messages', 'is_forwarded');
  }
}
