import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E-mail único entre os usuários.
 *
 * Não havia índice nenhum além da chave primária, e nada no código verificava:
 * dava para cadastrar dois usuários com o mesmo e-mail — inclusive um com o do
 * usuário master. Isso quebra o login, que busca **pelo e-mail** e usa o
 * primeiro registro que encontrar: quem entra passa a depender da ordem física
 * da tabela, e a senha correta de um dos dois é recusada.
 *
 * A validação no service dá a mensagem legível; este índice é o que garante,
 * porque duas requisições simultâneas passam pela verificação antes de
 * qualquer uma gravar.
 *
 * `lower(email)` porque e-mail não distingue maiúsculas na prática, e deixar
 * "Fulano@x.com" conviver com "fulano@x.com" recriaria o problema com outra
 * grafia.
 */
export class EmailUnicoEmUsers1789480000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Duplicatas existentes impediriam a criação do índice. Em vez de falhar o
    // deploy, os registros repetidos são desativados — o mais antigo fica, que
    // é o original, e os demais recebem um sufixo para liberar o endereço.
    await queryRunner.query(`
      WITH duplicados AS (
        SELECT id, row_number() OVER (PARTITION BY lower(email) ORDER BY id) AS pos
        FROM users
      )
      UPDATE users u
      SET email = u.email || '.duplicado-' || u.id, status = 0
      FROM duplicados d
      WHERE d.id = u.id AND d.pos > 1;
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_users_email" ON "users" (lower("email"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_users_email"`);
  }
}
