import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Resolução automática por inatividade, por canal - o atendimento parado por
 * X minutos (sem mensagem de nenhum dos dois lados) avisa o cliente e, sem
 * resposta, finaliza sozinho. `inatividade_ativa` desliga a feature inteira
 * sem apagar a configuração já preenchida.
 *
 * Status novo (id 6): distinto do `FINALIZADO_SEM_RESPOSTA` (id 4, já
 * semeado e nunca atribuído por código nenhum) - significados diferentes,
 * não reaproveitar aquele.
 *
 * `support_chats.inatividade_avisada_em` controla se o aviso já foi enviado
 * nesta janela de inatividade - zerado quando o relógio reseta (mensagem
 * nova depois do aviso), para permitir avisar de novo numa inatividade
 * futura.
 */
export class AddInactivityResolutionToChannels1789810000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO support_chat_status (id, name, is_final) VALUES (6, 'Finalizado por inatividade', true)",
    );

    await queryRunner.addColumns('channels', [
      new TableColumn({
        name: 'inatividade_ativa',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'inatividade_resolver_em_minutos',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'inatividade_avisar_em_minutos',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'inatividade_mensagem_aviso',
        type: 'text',
        isNullable: true,
      }),
    ]);

    await queryRunner.addColumn(
      'support_chats',
      new TableColumn({
        name: 'inatividade_avisada_em',
        type: 'timestamptz',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('support_chats', 'inatividade_avisada_em');

    await queryRunner.dropColumns('channels', [
      'inatividade_ativa',
      'inatividade_resolver_em_minutos',
      'inatividade_avisar_em_minutos',
      'inatividade_mensagem_aviso',
    ]);

    await queryRunner.query('DELETE FROM support_chat_status WHERE id = 6');
  }
}
