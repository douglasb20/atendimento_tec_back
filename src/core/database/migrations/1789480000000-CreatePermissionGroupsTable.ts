import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Grupos de permissão — "Atendente", "Supervisor", "Administrador".
 *
 * Substitui o vínculo direto entre usuário e permissão como caminho principal.
 * Com a lista por usuário, contratar cinco atendentes significava marcar as
 * mesmas doze permissões cinco vezes, e mudar o que um atendente pode fazer
 * virava edição em vários cadastros.
 *
 * A tabela `permission_x_user` continua existindo, vazia: é por onde as exceções
 * individuais entram depois (usuário que herda do papel e ganha ou perde uma
 * permissão pontual). Removê-la agora fecharia essa porta sem ganho nenhum.
 */
export class CreatePermissionGroupsTable1789480000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permission_groups',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '60', isNullable: false },
          { name: 'description', type: 'varchar', length: '150', isNullable: true, default: null },
          // Grupo de fábrica: as permissões podem ser ajustadas, o grupo não
          // pode ser excluído. Sem isto, apagar "Administrador" deixaria o
          // sistema sem ninguém capaz de recriá-lo.
          { name: 'is_system', type: 'boolean', isNullable: false, default: false },
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

    // Mesmo critério de `tags`: nome único entre os ativos, sem distinguir
    // maiúsculas, e liberado de novo depois que o grupo é excluído.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_permission_groups_name" ON "permission_groups" (lower("name")) WHERE "deleted_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_permission_groups_name"`);
    await queryRunner.dropTable('permission_groups', true);
  }
}
