import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * true quando o atendente iniciou o atendimento manualmente (modal "Novo
 * atendimento"); false quando nasceu do fluxo normal, mensagem do contato via
 * webhook.
 *
 * Default `false` para o que já existe: não significa "foi o cliente", só que
 * a informação não foi capturada antes desta coluna existir.
 */
export class AddStartedByAgentToSupportChats1790010000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'support_chats',
      new TableColumn({
        name: 'started_by_agent',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chats', 'started_by_agent');
  }
}
