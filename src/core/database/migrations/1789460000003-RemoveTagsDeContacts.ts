import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Remove a coluna `tags` de `contacts`.
 *
 * Criada na migration original da tabela e **nunca usada**: nenhum código a lê
 * ou escreve, e não há um registro sequer preenchido. Era texto livre, a
 * abordagem que o cadastro de etiquetas veio substituir - mantê-la deixaria dois
 * conceitos de "tag" no sistema, um deles morto.
 */
export class RemoveTagsDeContacts1789460000003 implements MigrationInterface {
  private readonly tabela = 'contacts';
  private readonly coluna = 'tags';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable(this.tabela);
    if (!tabela?.findColumnByName(this.coluna)) return;

    await queryRunner.dropColumn(this.tabela, this.coluna);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable(this.tabela);
    if (tabela?.findColumnByName(this.coluna)) return;

    await queryRunner.addColumn(
      this.tabela,
      new TableColumn({
        name: this.coluna,
        type: 'varchar',
        length: '150',
        isNullable: true,
        default: null,
      }),
    );
  }
}
