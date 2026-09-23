import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Move `tema` e `modo_tema` de `users` para `user_config`.
 *
 * Eram as duas únicas preferências guardadas em `users`, e cada opção nova
 * viraria mais uma coluna no cadastro. Com a tabela chave-valor, tema deixa de
 * ser exceção e passa a ser só mais uma preferência.
 *
 * ⚠️ **O carregamento do tema não muda.** Quem o resolve antes do primeiro byte
 * é o cookie `tema` (validade de um ano), lido em `app/layout.tsx` - o banco
 * nunca esteve nesse caminho. O que ele faz é reabastecer o cookie em máquina
 * nova, e isso passa a sair daqui, por `GET /users/info`.
 *
 * ⚠️ **Só copia o que não é nulo.** Nulo em `users.tema` significava "nunca
 * escolheu"; na tabela nova, a mesma coisa é a **ausência da chave**, que faz o
 * catálogo devolver o padrão. Copiar o nulo criaria linha dizendo "sem
 * preferência", que é diferente de não ter linha.
 */
export class MigrarTemaParaUserConfig1789600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Os dados primeiro, as colunas depois: falhar no meio deixa o tema
    // duplicado (recuperável), enquanto dropar antes de copiar o perderia.
    await queryRunner.query(`
      INSERT INTO user_config (user_id, chave, valor)
      SELECT id, 'tema', tema FROM users WHERE tema IS NOT NULL
      ON CONFLICT (user_id, chave) DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO user_config (user_id, chave, valor)
      SELECT id, 'modo_tema', modo_tema FROM users WHERE modo_tema IS NOT NULL
      ON CONFLICT (user_id, chave) DO NOTHING;
    `);

    await queryRunner.query('ALTER TABLE users DROP COLUMN tema;');
    await queryRunner.query('ALTER TABLE users DROP COLUMN modo_tema;');
  }

  /**
   * Devolve as colunas e os valores.
   *
   * Existe para valer: se o tema quebrar em produção, este é o caminho de
   * volta. As linhas ficam em `user_config` - a migration anterior é que apaga
   * a tabela, e desfazer só esta deve ser reversível sozinho.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE users ADD COLUMN tema VARCHAR(20) NULL;');
    await queryRunner.query('ALTER TABLE users ADD COLUMN modo_tema VARCHAR(10) NULL;');

    await queryRunner.query(`
      UPDATE users u
      SET tema = c.valor
      FROM user_config c
      WHERE c.user_id = u.id AND c.chave = 'tema';
    `);

    await queryRunner.query(`
      UPDATE users u
      SET modo_tema = c.valor
      FROM user_config c
      WHERE c.user_id = u.id AND c.chave = 'modo_tema';
    `);
  }
}
