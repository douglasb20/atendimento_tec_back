import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Vínculo entre grupo de permissão e permissão.
 *
 * Criada aqui, não pelo `synchronize` (desligado): o `@JoinTable` da entidade
 * `PermissionGroups` apenas aponta para ela pelo nome.
 *
 * `ON DELETE CASCADE` porque aqui ele é o caminho normal, não só rede de
 * segurança: trocar as permissões de um grupo é apagar as linhas antigas e
 * gravar as novas, e excluir o grupo leva os vínculos junto.
 */
export class CreatePermissionGroupXPermissionTable1789480000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permission_group_x_permission',
        columns: [
          { name: 'permission_group_id', type: 'int', isPrimary: true, isNullable: false },
          { name: 'permission_id', type: 'int', isPrimary: true, isNullable: false },
        ],
        foreignKeys: [
          {
            name: 'pgxpermission_group_fk',
            columnNames: ['permission_group_id'],
            referencedTableName: 'permission_groups',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'pgxpermission_permission_fk',
            columnNames: ['permission_id'],
            referencedTableName: 'permissions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // A PK composta cobre "quais permissões tem este grupo". Este índice atende
    // o sentido inverso, usado pelo guard a cada requisição protegida.
    await queryRunner.query(
      `CREATE INDEX "idx_pg_x_permission_permission_id" ON "permission_group_x_permission" ("permission_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pg_x_permission_permission_id"`);
    await queryRunner.dropTable('permission_group_x_permission', true);
  }
}
