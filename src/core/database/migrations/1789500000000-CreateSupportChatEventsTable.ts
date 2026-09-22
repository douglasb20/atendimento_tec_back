import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Eventos do atendimento - o que aconteceu com a conversa, fora as mensagens.
 *
 * Tabela própria, e não uma linha em `support_chat_messages`: aquela tabela é
 * espelho do WhatsApp (tem `message_id`, `ack`, `from`, `to`, `device_type`,
 * `raw_payload`), e uma linha sem nada disso obrigaria todo código que hoje
 * assume "toda mensagem veio do WhatsApp" a abrir exceção.
 *
 * Por ora só `transferencia`, mas a coluna `tipo` existe porque o mesmo lugar
 * serve para o que vier depois - pausa, reabertura, mudança de canal.
 *
 * ⚠️ É também o primeiro registro de **quem atendeu o quê**: até aqui o
 * `user_id` de `support_chats` era sobrescrito sem deixar rastro, e uma
 * conversa que passasse por três pessoas só lembrava da última.
 */
export class CreateSupportChatEventsTable1789500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'support_chat_events',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'support_chat_id', type: 'bigint', isNullable: false },
          // `transferencia` é o único valor hoje. Validado no código, como o
          // `tipo` de `custom_fields` - o banco não tem como.
          { name: 'tipo', type: 'varchar', length: '20', isNullable: false },
          // Quem transferiu. Nulo só se o usuário for removido depois.
          { name: 'user_origem_id', type: 'int', isNullable: true },
          // ⚠️ Nulo tem significado próprio aqui: **devolvido para a espera**,
          // sem destinatário. Não confundir com usuário removido - o
          // `user_origem_id` desambigua, porque os dois só ficam nulos juntos
          // quando a linha perdeu os dois usuários.
          { name: 'user_destino_id', type: 'int', isNullable: true },
          { name: 'motivo', type: 'text', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            name: 'supportchatevent_chat_fk',
            columnNames: ['support_chat_id'],
            referencedTableName: 'support_chats',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          // SET NULL, e não CASCADE: desligar um atendente não pode apagar o
          // histórico das transferências que ele fez. A tela cai para
          // "Atendente removido".
          {
            name: 'supportchatevent_origem_fk',
            columnNames: ['user_origem_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            name: 'supportchatevent_destino_fk',
            columnNames: ['user_destino_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // A leitura é sempre "os eventos desta conversa, em ordem", para intercalar
    // com as mensagens na tela.
    await queryRunner.query(
      `CREATE INDEX "idx_support_chat_events_conversa" ON "support_chat_events" ("support_chat_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_support_chat_events_conversa"`);
    await queryRunner.dropTable('support_chat_events', true);
  }
}
