import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separa o nome em `name` (primeiro nome) e `last_name` (sobrenome).
 *
 * O campo único servia enquanto o nome era só exibido. Quando ele passou a
 * alimentar variáveis de mensagem (`{{nome}}`, `{{atendente}}`), a falta da
 * separação virou limitação: uma saudação informal precisa do primeiro nome, e
 * derivá-lo por `split(' ')[0]` na hora do uso espalha a mesma heurística por
 * várias telas - hoje há três cópias dela no front.
 *
 * ⚠️ **O backfill divide na primeira palavra**, por decisão de projeto:
 * "Douglas A. Silva" vira `Douglas` + `A. Silva`. A regra acerta nome civil e
 * erra nome de empresa - "Automatec Sistemas" fica com sobrenome "Sistemas".
 * O `down` reconcatena, então o erro é reversível enquanto ninguém editar.
 *
 * Nome de uma palavra deixa `last_name` **nulo**, não uma cópia do nome: o
 * `position(' ' in ...)` devolve 0 nesse caso e um `substring` ingênuo
 * duplicaria o valor inteiro.
 *
 * As colunas acompanham o tamanho das existentes - 90 em `contacts`, 50 em
 * `users` - e nascem nulas: sobrenome é opcional nos dois cadastros, porque
 * contato pode ser empresa ou apelido vindo do `pushName` do WhatsApp.
 */
export class AddLastNameToContactsAndUsers1789530000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE contacts ADD COLUMN last_name VARCHAR(90) NULL;`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN last_name VARCHAR(50) NULL;`);

    // O `CASE` é o que evita a duplicação em nome de uma palavra só.
    for (const tabela of ['contacts', 'users']) {
      await queryRunner.query(`
        UPDATE ${tabela}
        SET
          last_name = CASE
            WHEN trim(name) ~ '\\s'
            THEN substring(trim(name) from position(' ' in trim(name)) + 1)
          END,
          name = split_part(trim(name), ' ', 1)
        WHERE name IS NOT NULL AND trim(name) <> '';
      `);
    }
  }

  /**
   * Reconcatena antes de derrubar a coluna: sem isto, voltar a migration
   * perderia o sobrenome de todo mundo.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tabela of ['contacts', 'users']) {
      await queryRunner.query(`
        UPDATE ${tabela}
        SET name = trim(name || ' ' || coalesce(last_name, ''))
        WHERE last_name IS NOT NULL AND last_name <> '';
      `);
    }

    await queryRunner.dropColumn('users', 'last_name');
    await queryRunner.dropColumn('contacts', 'last_name');
  }
}
