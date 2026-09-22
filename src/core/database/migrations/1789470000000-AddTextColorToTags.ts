import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Cor do texto da etiqueta: claro ou escuro.
 *
 * O cálculo automático por luminância acerta na maioria dos casos, mas as cores
 * médias caem perto do limiar e a decisão vira arbitrária - e às vezes a
 * preferência é estética, não de contraste. O campo passa a ser escolha de quem
 * cadastra, com o automático servindo de sugestão inicial no formulário.
 */
export class AddTextColorToTags1789470000000 implements MigrationInterface {
  private readonly tabela = 'tags';
  private readonly coluna = 'text_color';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable(this.tabela);
    if (tabela?.findColumnByName(this.coluna)) return;

    await queryRunner.addColumn(
      this.tabela,
      new TableColumn({
        name: this.coluna,
        type: 'varchar',
        length: '5',
        isNullable: false,
        default: "'light'",
      }),
    );

    // As etiquetas já cadastradas herdam o que o cálculo automático vinha
    // exibindo, para a aparência não mudar sozinha.
    //
    // A fórmula é a mesma do front (`corDoTextoSobre`): coeficientes de
    // luminância ITU-R BT.709 sobre os canais normalizados.
    await queryRunner.query(`
      UPDATE "tags"
         SET "text_color" = CASE
           WHEN (
             0.2126 * (('x' || substr("color", 2, 2))::bit(8)::int / 255.0) +
             0.7152 * (('x' || substr("color", 4, 2))::bit(8)::int / 255.0) +
             0.0722 * (('x' || substr("color", 6, 2))::bit(8)::int / 255.0)
           ) > 0.6 THEN 'dark'
           ELSE 'light'
         END
       WHERE length("color") = 7
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(this.tabela, this.coluna);
  }
}
