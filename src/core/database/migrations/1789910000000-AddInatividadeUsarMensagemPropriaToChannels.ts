import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Torna explícita a escolha entre a despedida padrão e um texto próprio no
 * encerramento por inatividade.
 *
 * Antes, `inatividade_mensagem_finalizacao` vazia significava "usa a
 * despedida" - regra implícita, e implícito é o que dá margem a erro: quem
 * reconfigurasse o canal meses depois apagaria o texto achando que estava
 * desligando a mensagem e, sem perceber, ligaria a despedida padrão (com o
 * anexo dela) no lugar.
 *
 * `false` para o que já existe: é o comportamento que esses canais têm hoje,
 * já que nenhum chegou a preencher o texto - a coluna nasceu na migration
 * anterior, nesta mesma leva.
 */
export class AddInatividadeUsarMensagemPropriaToChannels1789910000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'channels',
      new TableColumn({
        name: 'inatividade_usar_mensagem_propria',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('channels', 'inatividade_usar_mensagem_propria');
  }
}
