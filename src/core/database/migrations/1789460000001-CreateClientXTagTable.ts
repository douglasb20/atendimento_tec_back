import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Vínculo entre cliente e etiqueta.
 *
 * A tabela é criada aqui, e não pelo `synchronize` (que está desligado): o
 * `@JoinTable` da entidade `Clients` apenas aponta para ela pelo nome.
 *
 * `ON DELETE CASCADE` nos dois lados é rede de segurança para a linha apagada
 * por fora da aplicação — restauração de backup, manutenção direta no banco. No
 * caminho normal o service recusa remover etiqueta ainda vinculada.
 */
export class CreateClientXTagTable1789460000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'client_x_tag',
        columns: [
          { name: 'client_id', type: 'int', isPrimary: true, isNullable: false },
          { name: 'tag_id', type: 'int', isPrimary: true, isNullable: false },
        ],
        foreignKeys: [
          {
            name: 'clientxtag_client_fk',
            columnNames: ['client_id'],
            referencedTableName: 'clients',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'clientxtag_tag_fk',
            columnNames: ['tag_id'],
            referencedTableName: 'tags',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // A PK composta já cobre a busca por cliente; este índice atende o sentido
    // inverso — "quais clientes têm esta etiqueta" —, usado ao checar se a tag
    // pode ser removida.
    await queryRunner.query(`CREATE INDEX "idx_client_x_tag_tag_id" ON "client_x_tag" ("tag_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_client_x_tag_tag_id"`);
    await queryRunner.dropTable('client_x_tag', true);
  }
}
