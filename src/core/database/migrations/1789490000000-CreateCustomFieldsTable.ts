import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Catálogo de campos personalizados de contatos e clientes.
 *
 * O cadastro existe para que "CPF", "cpf" e "C.P.F." não virem três campos
 * distintos — sem ele, quem preenche inventa o nome na hora e a busca por
 * campo nunca funciona.
 *
 * ⚠️ **Estar no catálogo não põe o campo em nenhum contato.** Esta tabela é a
 * lista do que *pode* ser escolhido; quem decide os campos de cada contato é
 * quem edita, linha por linha, no formulário.
 */
export class CreateCustomFieldsTable1789490000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'custom_fields',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'nome', type: 'varchar', length: '60', isNullable: false },
          // `texto` | `numero` | `data` | `booleano` | `lista`. O valor é
          // sempre gravado como texto; é esta coluna que diz como interpretá-lo,
          // e é o código que garante — o banco não tem como.
          { name: 'tipo', type: 'varchar', length: '12', isNullable: false },
          // `contato` | `cliente` | `ambos`. Um "CNPJ" só faz sentido em
          // cliente; um "cargo", só em contato.
          { name: 'aplica_a', type: 'varchar', length: '8', isNullable: false },
          // Só para `tipo = lista`: `["Indicação", "Google", "Feira"]`.
          //
          // jsonb aqui é legítimo porque é lido inteiro para montar o seletor e
          // nunca consultado por dentro — mesmo uso de `integrations.credentials`.
          { name: 'opcoes', type: 'jsonb', isNullable: true, default: null },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true, default: null },
        ],
      }),
      true,
    );

    // Mesma regra das etiquetas: nome único entre os ativos, sem distinguir
    // maiúsculas. A condição libera o nome de novo depois da exclusão.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_custom_fields_nome" ON "custom_fields" (lower("nome")) WHERE "deleted_at" IS NULL`,
    );

    // A tela sempre pede os campos de um lado só (contato ou cliente), e
    // `ambos` entra nas duas consultas.
    await queryRunner.query(
      `CREATE INDEX "idx_custom_fields_aplica_a" ON "custom_fields" ("aplica_a") WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_custom_fields_aplica_a"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_custom_fields_nome"`);
    await queryRunner.dropTable('custom_fields', true);
  }
}
