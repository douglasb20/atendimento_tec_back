import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Pedidos de redefinição de senha.
 *
 * Guarda o **hash** do token, nunca o token: quem ler esta tabela - backup,
 * consulta de manutenção, vazamento - não consegue redefinir a senha de
 * ninguém. O valor em claro só existe no e-mail e na URL que o usuário recebe.
 *
 * A tabela também é o que permite o uso único: `used_at` marca o consumo, e um
 * link já usado deixa de valer mesmo dentro do prazo. Um token autocontido
 * (criptografado ou assinado) não teria como oferecer isso.
 */
export class CreatePasswordResetsTable1789480000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_resets',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'user_id', type: 'int', isNullable: false },
          // SHA-256 em hexadecimal: 64 caracteres, tamanho fixo.
          { name: 'token_hash', type: 'varchar', length: '64', isNullable: false },
          { name: 'expires_at', type: 'timestamptz', isNullable: false },
          { name: 'used_at', type: 'timestamptz', isNullable: true, default: null },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            name: 'passwordresets_user_fk',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // O hash é a chave de busca na validação, e precisa ser único: dois
    // pedidos com o mesmo hash tornariam ambíguo qual consumir.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_password_resets_token_hash" ON "password_resets" ("token_hash")`,
    );

    // Atende "quais pedidos deste usuário ainda valem", usado para invalidar os
    // anteriores quando ele pede de novo.
    await queryRunner.query(
      `CREATE INDEX "idx_password_resets_user_used" ON "password_resets" ("user_id", "used_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_password_resets_user_used"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_password_resets_token_hash"`);
    await queryRunner.dropTable('password_resets', true);
  }
}
