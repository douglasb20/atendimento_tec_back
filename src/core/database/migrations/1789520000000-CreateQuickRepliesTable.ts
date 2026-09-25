import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Respostas rápidas - mensagens prontas que o atendente insere digitando
 * `/atalho` na conversa.
 *
 * Compartilhadas, sem dono: o sentido é padronizar o que a empresa responde.
 * Por atendente, dez pessoas escreveriam dez saudações diferentes, que é
 * exatamente o que isto existe para evitar.
 *
 * ⚠️ **O anexo guarda a `key`, não a URL** - como `avatar_url` e `media_url`
 * fazem. A conversão para URL pública acontece na leitura.
 *
 * ⚠️ O arquivo do anexo é **permanente**: fica no prefixo `quick-replies/`, que
 * o cron de retenção de mídia não alcança. No envio, o backend faz uma cópia
 * para `chat/media/`, e é a cópia que a mensagem referencia - senão a retenção
 * apagaria o arquivo do cadastro meses depois e quebraria todas as respostas de
 * uma vez.
 */
export class CreateQuickRepliesTable1789520000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'quick_replies',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          // Sem a barra: ela é o gatilho na caixa de mensagem, não parte do
          // nome. Guardá-la obrigaria a tirá-la em toda comparação.
          { name: 'atalho', type: 'varchar', length: '40', isNullable: false },
          { name: 'mensagem', type: 'text', isNullable: false },

          // O anexo é opcional e vem em quatro partes porque o envio precisa
          // das quatro: a key para achar o arquivo, o nome para o WhatsApp
          // exibir, o mimetype para o provider, e o tipo para escolher entre
          // imagem, vídeo, áudio e documento.
          { name: 'anexo_key', type: 'varchar', length: '255', isNullable: true },
          { name: 'anexo_nome', type: 'varchar', length: '255', isNullable: true },
          { name: 'anexo_mimetype', type: 'varchar', length: '100', isNullable: true },
          { name: 'anexo_tipo', type: 'varchar', length: '10', isNullable: true },

          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true, default: null },
        ],
      }),
      true,
    );

    // Mesma regra das etiquetas: único entre os ativos, sem distinguir
    // maiúsculas - `/Bemvindo` e `/bemvindo` seriam o mesmo atalho para quem
    // digita. A condição libera o nome de novo depois da exclusão.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_quick_replies_atalho" ON "quick_replies" (lower("atalho")) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_quick_replies_atalho"`);
    await queryRunner.dropTable('quick_replies', true);
  }
}
