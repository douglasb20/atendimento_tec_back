import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Preferência de tema de cada usuário.
 *
 * Duas colunas curtas, e não um JSON com o layout inteiro (como faz o sistema
 * que serviu de referência): o leque é fechado e pequeno, e o valor precisa
 * caber no cookie `userInfo`, que tem teto de 4 KB — já houve laço de
 * redirecionamento aqui por estourá-lo. Se um dia guardarmos mais preferências
 * de layout (tamanho de fonte, modo do menu), aí sim cabe um `jsonb` ao lado.
 *
 * ⚠️ **Nulo significa "nunca escolheu"**, e o front cai no padrão
 * (`automatec`/`claro`, que é a cara atual do sistema). Não preencho as linhas
 * existentes de propósito: um default gravado faria parecer escolha do usuário,
 * e mudar o padrão depois não alcançaria quem nunca abriu a tela.
 *
 * Os valores válidos vivem em `front/scripts/temas.config.mjs` e são validados
 * no DTO — o banco guarda o identificador, como o `tipo` de `custom_fields`.
 */
export class AddPreferenciasTemaToUsers1789510000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN tema VARCHAR(20) NULL,
      ADD COLUMN modo_tema VARCHAR(10) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('users', ['tema', 'modo_tema']);
  }
}
