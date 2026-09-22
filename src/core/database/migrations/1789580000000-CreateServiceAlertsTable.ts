import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Avisos temporários enviados na abertura do atendimento.
 *
 * O caso que os motiva: um serviço externo cai - a Sefaz, por exemplo - e todo
 * mundo liga para o suporte pelo mesmo motivo. O aviso avisa antes de a pessoa
 * digitar a dúvida, e some quando o problema passa.
 *
 * ⚠️ **Não é a saudação do canal.** Aquela é permanente e descreve o
 * atendimento; esta é temporária e descreve um problema. Misturá-las obrigaria
 * a editar a saudação na correria de um incidente e a lembrar de desfazer
 * depois - que é exatamente o que se esquece.
 *
 * ⚠️ **Nem é chatbot.** Não há ramificação nem espera por resposta: o texto sai
 * e o atendimento segue normal. Fluxos com passos ficam para o chatbot, que
 * será construído à parte.
 *
 * Duas colunas governam o envio, e as duas precisam passar:
 * - `ativo`, o liga/desliga manual - o controle do dia a dia;
 * - `expira_em`, opcional, para manutenção programada. Nulo significa "até
 *   alguém desligar". Ter as duas evita o aviso esquecido ligado na sexta e
 *   ainda saindo na segunda.
 */
export class CreateServiceAlertsTable1789580000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'service_alerts',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          // Só para a tela de gerenciamento: o cliente não vê o título, vê a
          // mensagem. Serve para achar o aviso na lista sem ler o texto todo.
          { name: 'titulo', type: 'varchar', length: '100', isNullable: false },
          { name: 'mensagem', type: 'text', isNullable: false },

          { name: 'ativo', type: 'boolean', isNullable: false, default: true },

          // Nulo = sem prazo, vale até desligarem. `timestamptz` como as
          // colunas novas do projeto.
          { name: 'expira_em', type: 'timestamptz', isNullable: true },

          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    // A consulta do envio roda em toda abertura de conversa: filtra pelos
    // ativos e não excluídos.
    await queryRunner.query(
      'CREATE INDEX idx_service_alerts_ativos ON service_alerts (ativo) WHERE deleted_at IS NULL;',
    );

    /**
     * Quais canais recebem cada aviso.
     *
     * Tabela de junção, e não uma coluna `channel_id`: um mesmo incidente
     * costuma afetar mais de um canal, e um aviso por canal obrigaria a criar
     * e desligar o mesmo texto várias vezes.
     *
     * **Sem linha nenhuma = vale para todos os canais.** É o caso comum (o
     * serviço caiu para todo mundo) e evita obrigar a marcar canal por canal
     * no meio de um incidente.
     */
    await queryRunner.createTable(
      new Table({
        name: 'service_alert_x_channel',
        columns: [
          { name: 'service_alert_id', type: 'int', isPrimary: true },
          { name: 'channel_id', type: 'int', isPrimary: true },
        ],
        foreignKeys: [
          {
            name: 'fk_service_alert_x_channel_alert',
            columnNames: ['service_alert_id'],
            referencedTableName: 'service_alerts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            name: 'fk_service_alert_x_channel_channel',
            columnNames: ['channel_id'],
            referencedTableName: 'channels',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      'CREATE INDEX idx_service_alert_x_channel_channel ON service_alert_x_channel (channel_id);',
    );

    // Módulo 15, permissões 60-63: a numeração explícita das seeds continua.
    await queryRunner.query("INSERT INTO permission_module(id, nome) VALUES (15,'Avisos');");

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (60, 'Visualizar avisos', 15, 'service.alert:view'), \
      (61, 'Adicionar aviso', 15, 'service.alert:add'), \
      (62, 'Alterar aviso', 15, 'service.alert:update'), \
      (63, 'Remover aviso', 15, 'service.alert:delete');",
    );

    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id BETWEEN 60 AND 63 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 60 AND 63;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 60 AND 63;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 60 AND 63;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 15;');

    await queryRunner.dropTable('service_alert_x_channel', true);
    await queryRunner.dropTable('service_alerts', true);
  }
}
