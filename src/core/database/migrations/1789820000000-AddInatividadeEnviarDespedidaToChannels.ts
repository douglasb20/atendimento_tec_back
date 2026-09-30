import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Opt-in para enviar `mensagem_despedida` também ao finalizar por
 * inatividade - antes disso, `finalizarPorInatividade` sempre enviava a
 * despedida quando configurada, mesmo o cliente já tendo sido avisado (ou
 * nem isso, quando o atraso encontrado pelo cron já passava do prazo de
 * resolver), o que pode soar redundante num encerramento por abandono.
 */
export class AddInatividadeEnviarDespedidaToChannels1789820000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'channels',
      new TableColumn({
        name: 'inatividade_enviar_despedida',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('channels', 'inatividade_enviar_despedida');
  }
}
