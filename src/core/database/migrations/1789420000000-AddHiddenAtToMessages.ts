import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Ocultação local de mensagem, equivalente ao "Apagar para mim" do WhatsApp.
 *
 * Distinta de `is_deleted`, que é a revogação no WhatsApp e alcança o contato.
 * Aqui a mensagem apenas deixa de aparecer no portal: no aparelho do cliente
 * ela continua. Serve para o caso em que a janela de revogação (60h) já passou
 * e o atendente ainda quer limpar a conversa do próprio lado.
 *
 * A linha é preservada — o histórico de um atendimento é registro de trabalho,
 * e a coluna guarda *quando* foi oculta, permitindo auditar e reverter.
 */
export class AddHiddenAtToMessages1789420000000 implements MigrationInterface {
  private readonly tabela = 'support_chat_messages';
  private readonly coluna = 'hidden_at';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable(this.tabela);
    if (tabela?.findColumnByName(this.coluna)) return;

    await queryRunner.addColumn(
      this.tabela,
      new TableColumn({
        name: this.coluna,
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    // A listagem filtra por esta coluna em toda conversa aberta; sem índice a
    // varredura cresce com o histórico.
    await queryRunner.query(
      `CREATE INDEX "IDX_support_chat_messages_hidden_at" ON "${this.tabela}" ("hidden_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_support_chat_messages_hidden_at"`);
    await queryRunner.dropColumn(this.tabela, this.coluna);
  }
}
