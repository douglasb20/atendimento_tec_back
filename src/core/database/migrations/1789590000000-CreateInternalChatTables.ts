import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Conversa direta entre dois usuários do portal.
 *
 * O caso que a motiva: combinar a passagem de um atendimento, avisar que um
 * serviço caiu, pedir ajuda com um cliente. Hoje isso acontece em grupo de
 * WhatsApp pessoal, fora do sistema - sem histórico consultável e misturado com
 * conversa particular.
 *
 * ⚠️ **Não é atendimento.** Não tem protocolo, status, fila nem dono: é
 * conversa entre colegas. Por isso tabela própria, e não uma variação de
 * `support_chats` - aquela carrega canal, contato e ciclo de vida que aqui não
 * existem.
 *
 * ⚠️ **São sempre duas pessoas.** Grupo exigiria tabela de participantes; o par
 * fixo em duas colunas permite a unicidade que impede a conversa duplicada, que
 * é o problema real de quem começa a escrever de dois lugares ao mesmo tempo.
 */
export class CreateInternalChatTables1789590000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'internal_chats',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },

          // O par é gravado ordenado: sempre o menor id em `user_a_id`. Sem
          // isso, A→B e B→A criariam duas conversas para a mesma dupla, cada
          // uma com metade das mensagens.
          { name: 'user_a_id', type: 'int', isNullable: false },
          { name: 'user_b_id', type: 'int', isNullable: false },

          // Ordena a lista de conversas sem precisar agregar as mensagens a
          // cada abertura da tela. Nulo enquanto ninguém escreveu.
          { name: 'last_message_at', type: 'timestamptz', isNullable: true },

          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'fk_internal_chats_user_a',
            columnNames: ['user_a_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_internal_chats_user_b',
            columnNames: ['user_b_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    /**
     * A ordem do par é garantida pelo banco, não pela aplicação.
     *
     * Com a checagem só no código, bastaria um caminho de escrita novo
     * esquecer de ordenar para nascer a conversa espelhada - e o índice único
     * abaixo não a pegaria, porque (2,5) e (5,2) são pares distintos. A
     * constraint fecha os dois buracos de uma vez: a inversão é recusada, e o
     * único passa a valer para a dupla, não para a ordem em que ela foi
     * gravada.
     *
     * `<` e não `<>`: além de impedir a inversão, impede a conversa de alguém
     * consigo mesmo.
     */
    await queryRunner.query(
      'ALTER TABLE internal_chats ADD CONSTRAINT ck_internal_chats_par_ordenado CHECK (user_a_id < user_b_id);',
    );

    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_internal_chats_par ON internal_chats (user_a_id, user_b_id);',
    );

    // A consulta inversa - "as conversas de fulano" - bate nas duas colunas. O
    // único acima já serve de índice para `user_a_id`; `user_b_id` precisa do
    // seu.
    await queryRunner.query('CREATE INDEX idx_internal_chats_user_b ON internal_chats (user_b_id);');

    /**
     * As mensagens.
     *
     * Espelha o que já se provou em `support_chat_messages`, sem o que é do
     * WhatsApp: `ack` (não há entrega em duas etapas), `message_id` do
     * provider, `from`/`to` como JID, `device_type` e `raw_payload`.
     *
     * Ficam de fora, por ora: reação, citação, edição e apagar. A tabela do
     * WhatsApp tem tudo isso; aqui entra quando for pedido, para não carregar
     * colunas que ninguém escreve.
     */
    await queryRunner.createTable(
      new Table({
        name: 'internal_chat_messages',
        columns: [
          // uuid como em `support_chat_messages`: o front cria a bolha antes da
          // confirmação do servidor, e o id precisa nascer no cliente.
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },

          { name: 'internal_chat_id', type: 'bigint', isNullable: false },
          { name: 'sender_id', type: 'int', isNullable: false },

          // text | image | video | document | audio | voice
          { name: 'type', type: 'varchar', length: '20', isNullable: false },

          // O texto, ou a legenda quando há mídia.
          { name: 'content', type: 'text', isNullable: true },

          { name: 'has_media', type: 'boolean', isNullable: false, default: false },

          // ⚠️ Guarda a **key** do storage, não a URL - como `media_url` em
          // `support_chat_messages` e `avatar_url` em `users`. A URL pública
          // sai na leitura, por `storageService.getPublicUrl()`.
          { name: 'media_url', type: 'varchar', length: '255', isNullable: true },
          // 100, e não os 20 de `support_chat_messages`: lá só entram tipos do
          // WhatsApp (`image/jpeg`, `audio/ogg`), enquanto aqui vai qualquer
          // documento - o mimetype de um .docx tem 65 caracteres.
          { name: 'media_type', type: 'varchar', length: '100', isNullable: true },
          { name: 'media_size', type: 'int', isNullable: true },
          { name: 'file_name', type: 'varchar', length: '255', isNullable: true },

          // Mídia varrida pela retenção. A mensagem fica: o front mostra
          // "mídia expirada", que é diferente de mensagem apagada.
          { name: 'media_expired', type: 'boolean', isNullable: false, default: false },
          { name: 'media_expired_at', type: 'timestamptz', isNullable: true },

          // Quando o destinatário leu. Nulo = não lida, e é dele que sai o
          // contador da lista.
          { name: 'read_at', type: 'timestamptz', isNullable: true },

          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'fk_internal_chat_messages_chat',
            columnNames: ['internal_chat_id'],
            referencedTableName: 'internal_chats',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_internal_chat_messages_sender',
            columnNames: ['sender_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // A paginação da conversa: as mais recentes primeiro, de trás para frente.
    await queryRunner.query(
      'CREATE INDEX idx_internal_chat_messages_conversa ON internal_chat_messages (internal_chat_id, created_at DESC);',
    );

    // O contador de não lidas roda a cada abertura da lista, para cada
    // conversa. Parcial porque só as não lidas interessam - as lidas são a
    // maioria e ficariam fora do índice.
    await queryRunner.query(
      'CREATE INDEX idx_internal_chat_messages_nao_lidas ON internal_chat_messages (internal_chat_id, sender_id) WHERE read_at IS NULL;',
    );

    // A varredura da retenção: mídia viva e antiga. Mesma forma do índice que
    // serve `MediaRetentionService` no WhatsApp.
    await queryRunner.query(
      'CREATE INDEX idx_internal_chat_messages_midia ON internal_chat_messages (created_at) WHERE has_media = true AND media_expired = false;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // As mensagens primeiro: a FK aponta para as conversas.
    await queryRunner.dropTable('internal_chat_messages', true);
    await queryRunner.dropTable('internal_chats', true);
  }
}
