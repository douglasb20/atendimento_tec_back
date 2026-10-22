import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from 'typeorm';

/**
 * `chatbots.channel_id` (1 canal por chatbot) vira M:N (`channel_x_chatbot`) -
 * decisão revertida: o mesmo chatbot (ex.: uma triagem padrão) agora pode
 * ficar ligado a vários canais, sem duplicar o fluxo inteiro para cada um.
 *
 * A trava "só um chatbot ativo de cada tipo por canal" (`uq_chatbots_
 * channel_type_active`, migration `1789630000000`) não é mais uma constraint
 * de banco - com M:N ela vira "nenhum canal pode ter dois *vínculos* para
 * chatbots do mesmo tipo", verificada na aplicação (`ChatbotsService`,
 * decisão do usuário: risco de corrida aceitável para volume de cadastro).
 *
 * `type = 'complementar'` nunca teve `channel_id` e continua sem nenhum
 * vínculo de canal - essa mudança não afeta os fluxos complementares.
 */
export class ChatbotChannelParaMuitosParaMuitos1790020000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'channel_x_chatbot',
        columns: [
          { name: 'channel_id', type: 'bigint', isPrimary: true, isNullable: false },
          { name: 'chatbot_id', type: 'int', isPrimary: true, isNullable: false },
        ],
        foreignKeys: [
          {
            name: 'channelxchatbot_channel_fk',
            columnNames: ['channel_id'],
            referencedTableName: 'channels',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'channelxchatbot_chatbot_fk',
            columnNames: ['chatbot_id'],
            referencedTableName: 'chatbots',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // A PK composta cobre "canais de um chatbot"; este índice atende o
    // sentido inverso - "chatbots de um canal" -, que é o que o motor
    // (`findEntradaAtivoDoCanal`) e a listagem de canal perguntam.
    await queryRunner.query(
      'CREATE INDEX idx_channel_x_chatbot_channel ON channel_x_chatbot (channel_id);',
    );

    // Migra os vínculos existentes antes de apagar a coluna - um chatbot com
    // channel_id preenchido vira uma linha na tabela nova.
    await queryRunner.query(`
      INSERT INTO channel_x_chatbot (channel_id, chatbot_id)
      SELECT channel_id, id FROM chatbots WHERE channel_id IS NOT NULL
    `);

    await queryRunner.query('DROP INDEX IF EXISTS uq_chatbots_channel_type_active');
    await queryRunner.dropForeignKey('chatbots', 'chatbots_channel_fk');
    await queryRunner.dropColumn('chatbots', 'channel_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'chatbots',
      new TableColumn({ name: 'channel_id', type: 'int', isNullable: true }),
    );

    await queryRunner.createForeignKey(
      'chatbots',
      new TableForeignKey({
        name: 'chatbots_channel_fk',
        columnNames: ['channel_id'],
        referencedTableName: 'channels',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Restaura só o primeiro canal de cada chatbot - M:N não tem volta exata
    // para 1:N sem perder vínculos extras; aceitável porque down() é usado só
    // em desenvolvimento, nunca em produção.
    await queryRunner.query(`
      UPDATE chatbots c
      SET channel_id = (
        SELECT channel_id FROM channel_x_chatbot WHERE chatbot_id = c.id LIMIT 1
      )
    `);

    await queryRunner.query(
      "CREATE UNIQUE INDEX uq_chatbots_channel_type_active ON chatbots (channel_id, type) \
       WHERE deleted_at IS NULL AND active = true AND channel_id IS NOT NULL;",
    );

    await queryRunner.dropTable('channel_x_chatbot', true);
  }
}
