import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Texto próprio para o encerramento por inatividade, no lugar da
 * `mensagem_despedida`.
 *
 * Até aqui `inatividade_enviar_despedida` só escolhia entre a despedida
 * padrão e o silêncio, e nenhuma das duas serve: "Obrigado pelo atendimento"
 * pressupõe uma conclusão que não houve, e não diz ao cliente - que sumiu no
 * meio - que ele pode voltar a escrever para ser atendido de novo.
 *
 * Nulo mantém o comportamento de hoje (envia a despedida padrão, com o anexo
 * dela), então nenhum canal já cadastrado muda de comportamento.
 */
export class AddInatividadeMensagemFinalizacaoToChannels1789900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'channels',
      new TableColumn({
        name: 'inatividade_mensagem_finalizacao',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('channels', 'inatividade_mensagem_finalizacao');
  }
}
