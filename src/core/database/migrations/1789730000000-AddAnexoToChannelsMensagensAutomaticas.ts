import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Anexo opcional para a saudação e para a despedida do canal, independentes
 * entre si - quatro colunas por mensagem, mesmo padrão de `quick_replies`
 * (`1789520000000`).
 *
 * ⚠️ **O anexo guarda a `key`, não a URL** - a conversão para URL pública
 * acontece na leitura. E é **permanente**: fica em `channels/`, prefixo que o
 * cron de retenção de mídia não alcança. No envio, o backend copia para
 * `chat/media/`, e é a cópia que a mensagem referencia - senão a retenção
 * apagaria o arquivo do cadastro meses depois e quebraria a saudação/despedida
 * de todos os canais de uma vez, em silêncio.
 */
export class AddAnexoToChannelsMensagensAutomaticas1789730000000 implements MigrationInterface {
  private readonly colunas = ['saudacao', 'despedida'].flatMap((prefixo) => [
    new TableColumn({
      name: `${prefixo}_anexo_key`,
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: `${prefixo}_anexo_nome`,
      type: 'varchar',
      length: '255',
      isNullable: true,
    }),
    new TableColumn({
      name: `${prefixo}_anexo_mimetype`,
      type: 'varchar',
      length: '100',
      isNullable: true,
    }),
    new TableColumn({
      name: `${prefixo}_anexo_tipo`,
      type: 'varchar',
      length: '10',
      isNullable: true,
    }),
  ]);

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('channels', this.colunas);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns(
      'channels',
      this.colunas.map((c) => c.name),
    );
  }
}
