import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Etiquetas coloridas para classificar clientes.
 *
 * Substitui a ideia de texto livre — que existia como a coluna `tags` em
 * `contacts`, nunca usada: sem um cadastro, "urgente", "Urgente" e "URGENTE"
 * viram três classificações distintas e nenhuma consulta confiável.
 */
export class CreateTagsTable1789460000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tags',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '60', isNullable: false },
          // `#RRGGBB`. O ColorPicker do front devolve o hex sem `#`, e a
          // normalização acontece lá — aqui o formato é sempre o completo.
          { name: 'color', type: 'varchar', length: '7', isNullable: false },
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

    // Nome único entre as ativas, sem distinguir maiúsculas: duas etiquetas
    // "Premium" e "premium" derrotariam o propósito de ter um cadastro. A
    // condição deixa o nome livre de novo depois que a tag é excluída.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_tags_name" ON "tags" (lower("name")) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_tags_name"`);
    await queryRunner.dropTable('tags', true);
  }
}
