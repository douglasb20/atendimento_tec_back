import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * O estado de uma execução de fluxo em andamento (ou suspensa, ou já
 * terminada). É a fonte de verdade do motor - não o Redis, que serve só a
 * fila/locks. Precisa sobreviver a dias de espera pela resposta do contato e
 * a restarts do processo.
 *
 * `flow_version_id` aponta para uma versão **publicada e imutável** - editar o
 * fluxo depois nunca afeta uma execução já em andamento.
 *
 * `call_stack` resolve fluxos complementares aninhados: uma pilha de frames
 * `{flow_version_id, node_id, return_handle}`, o mesmo conceito de call stack
 * de linguagem de programação.
 */
export class CreateChatbotFlowExecutionsTable1789640000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'chatbot_flow_executions',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'contact_id', type: 'int', isNullable: false },
          { name: 'support_chat_id', type: 'bigint', isNullable: true },
          { name: 'chatbot_id', type: 'int', isNullable: false },
          // A versão raiz que iniciou a execução - nunca muda depois de criada.
          { name: 'flow_version_id', type: 'bigint', isNullable: false },
          // O grafo em que `current_node_id` de fato vive agora - é a versão
          // raiz enquanto a execução está no fluxo principal, e a versão do
          // subfluxo enquanto está dentro de um "Executar Fluxo". Sem isso,
          // retomar uma execução suspensa dentro de um subfluxo não saberia
          // qual grafo carregar para achar o nó atual.
          { name: 'current_flow_version_id', type: 'bigint', isNullable: false },
          // 'running' | 'suspended' | 'completed' | 'failed' | 'aborted'
          { name: 'status', type: 'varchar', length: '12', isNullable: false },
          { name: 'call_stack', type: 'jsonb', default: "'[]'" },
          { name: 'variables', type: 'jsonb', default: "'{}'" },
          { name: 'counters', type: 'jsonb', default: "'{}'" },
          { name: 'waiting_for', type: 'jsonb', isNullable: true },
          { name: 'current_node_id', type: 'varchar', length: '64', isNullable: true },
          { name: 'version', type: 'int', default: 1 },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
          { name: 'finished_at', type: 'timestamptz', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'chatbotflowexecutions_contact_fk',
            columnNames: ['contact_id'],
            referencedTableName: 'contacts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'chatbotflowexecutions_supportchat_fk',
            columnNames: ['support_chat_id'],
            referencedTableName: 'support_chats',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
          {
            name: 'chatbotflowexecutions_chatbot_fk',
            columnNames: ['chatbot_id'],
            referencedTableName: 'chatbots',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'chatbotflowexecutions_flowversion_fk',
            columnNames: ['flow_version_id'],
            referencedTableName: 'chatbot_flow_versions',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
          {
            name: 'chatbotflowexecutions_currentflowversion_fk',
            columnNames: ['current_flow_version_id'],
            referencedTableName: 'chatbot_flow_versions',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Localizar rápido "há execução pendente para este contato" na retomada -
    // é a consulta mais frequente do motor, feita a cada mensagem recebida.
    await queryRunner.query(
      "CREATE INDEX idx_chatbot_flow_executions_contact_pendente ON chatbot_flow_executions (contact_id) \
       WHERE status IN ('running', 'suspended');",
    );

    await queryRunner.query(
      'CREATE INDEX idx_chatbot_flow_executions_support_chat ON chatbot_flow_executions (support_chat_id);',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('chatbot_flow_executions', true);
  }
}
