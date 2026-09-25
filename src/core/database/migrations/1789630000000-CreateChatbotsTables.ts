import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Chatbot por fluxo visual.
 *
 * Um `chatbot` é só o cadastro (nome, tipo, canal, configurações) - o grafo em
 * si vive em `chatbot_flow_versions`, versionado. O rascunho (`draft`) é
 * sempre editável e sobrescrito a cada "Salvar"; "Publicar" congela uma cópia
 * imutável, para que editar e publicar de novo nunca afete uma conversa que já
 * está no meio de uma execução (`chatbot_flow_executions.flow_version_id`
 * aponta para a versão congelada do momento em que a execução começou).
 *
 * `type = 'complementar'` são os fluxos complementares (subfluxos, chamados
 * pelo nó "Executar Fluxo") - mesma tabela, sem canal, compartilháveis entre
 * qualquer chatbot do sistema.
 */
export class CreateChatbotsTables1789630000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'chatbots',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '120', isNullable: false },
          // 'entrada' | 'saida' | 'agendamento' | 'complementar'
          { name: 'type', type: 'varchar', length: '20', isNullable: false },
          { name: 'active', type: 'boolean', default: true },
          { name: 'channel_id', type: 'int', isNullable: true },
          { name: 'settings', type: 'jsonb', default: "'{}'" },
          { name: 'current_published_version_id', type: 'bigint', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'chatbots_channel_fk',
            columnNames: ['channel_id'],
            referencedTableName: 'channels',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Nome único entre os não removidos, sem diferença de maiúsculas.
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_chatbots_name ON chatbots (lower(name)) WHERE deleted_at IS NULL;',
    );

    // Só um chatbot ativo de cada tipo por canal - trocar de fluxo é desativar
    // um e ativar outro, não empilhar vários concorrentes no mesmo canal.
    await queryRunner.query(
      "CREATE UNIQUE INDEX uq_chatbots_channel_type_active ON chatbots (channel_id, type) \
       WHERE deleted_at IS NULL AND active = true AND channel_id IS NOT NULL;",
    );

    await queryRunner.createTable(
      new Table({
        name: 'chatbot_flow_versions',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'chatbot_id', type: 'int', isNullable: false },
          // 'draft' | 'published' | 'archived'
          { name: 'status', type: 'varchar', length: '10', isNullable: false },
          { name: 'graph', type: 'jsonb', isNullable: false },
          { name: 'version_number', type: 'int', isNullable: false },
          { name: 'published_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
        foreignKeys: [
          {
            name: 'chatbotflowversions_chatbot_fk',
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

    // Um único rascunho vivo por chatbot - "Salvar" sempre sobrescreve esta
    // linha; "Publicar" congela o conteúdo dela numa nova linha `published`.
    await queryRunner.query(
      "CREATE UNIQUE INDEX uq_chatbot_flow_versions_draft ON chatbot_flow_versions (chatbot_id) \
       WHERE status = 'draft';",
    );

    await queryRunner.query(
      'CREATE INDEX idx_chatbot_flow_versions_chatbot ON chatbot_flow_versions (chatbot_id);',
    );

    // FK circular controlada: só criada depois que as duas tabelas existem.
    await queryRunner.query(
      'ALTER TABLE chatbots ADD CONSTRAINT chatbots_current_published_version_fk \
       FOREIGN KEY (current_published_version_id) REFERENCES chatbot_flow_versions(id) \
       ON DELETE SET NULL ON UPDATE CASCADE;',
    );

    // Módulo 18, permissões 70-78: a numeração explícita das seeds continua.
    await queryRunner.query("INSERT INTO permission_module(id, nome) VALUES (18,'Chatbot');");

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (70, 'Visualizar chatbots', 18, 'chatbot:view'), \
      (71, 'Adicionar chatbot', 18, 'chatbot:add'), \
      (72, 'Alterar chatbot', 18, 'chatbot:update'), \
      (73, 'Remover chatbot', 18, 'chatbot:delete'), \
      (74, 'Publicar fluxo de chatbot', 18, 'chatbot:publish'), \
      (75, 'Visualizar feriados', 18, 'holiday:view'), \
      (76, 'Adicionar feriado', 18, 'holiday:add'), \
      (77, 'Alterar feriado', 18, 'holiday:update'), \
      (78, 'Remover feriado', 18, 'holiday:delete');",
    );

    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id BETWEEN 70 AND 78 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 70 AND 78;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 70 AND 78;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 70 AND 78;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 18;');

    await queryRunner.query(
      'ALTER TABLE chatbots DROP CONSTRAINT IF EXISTS chatbots_current_published_version_fk;',
    );
    await queryRunner.dropTable('chatbot_flow_versions', true);
    await queryRunner.dropTable('chatbots', true);
  }
}
