import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Convites de cadastro de usuário.
 *
 * Mesma receita de `password_resets`: guarda o **hash** do token, nunca o
 * token em claro, e `used_at` marca o consumo - um link já aceito deixa de
 * valer mesmo dentro do prazo. Tabela própria, e não a mesma de redefinição
 * de senha: são fluxos diferentes (completar um cadastro vs. trocar senha de
 * conta existente), e misturar os dois exigiria um campo discriminador.
 */
export class CreateUserInvitesTable1789770000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_invites',
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
            name: 'userinvites_user_fk',
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

    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_user_invites_token_hash" ON "user_invites" ("token_hash")`,
    );

    // Atende "qual o convite mais recente deste usuário" (status da listagem)
    // e "quais convites pendentes invalidar" (reenvio).
    await queryRunner.query(
      `CREATE INDEX "idx_user_invites_user_used" ON "user_invites" ("user_id", "used_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_user_invites_user_used"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_user_invites_token_hash"`);
    await queryRunner.dropTable('user_invites', true);
  }
}
