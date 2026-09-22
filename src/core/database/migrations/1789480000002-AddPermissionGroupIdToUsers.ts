import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

/**
 * Liga o usuário ao seu grupo de permissão.
 *
 * Nulo é estado válido: usuário sem grupo não tem permissão alguma, e é assim
 * que um cadastro recém-criado nasce até alguém decidir o que ele pode fazer.
 * `ON DELETE SET NULL` mantém isso coerente - excluir um grupo não apaga quem o
 * usava, só o deixa sem acesso.
 *
 * A coluna `users.role` (varchar, `'USER'` por padrão) fica onde está: nenhum
 * guard a lê, e removê-la é escopo à parte.
 */
export class AddPermissionGroupIdToUsers1789480000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({ name: 'permission_group_id', type: 'int', isNullable: true, default: null }),
    );

    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        name: 'users_permission_group_fk',
        columnNames: ['permission_group_id'],
        referencedTableName: 'permission_groups',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('users', 'users_permission_group_fk');
    await queryRunner.dropColumn('users', 'permission_group_id');
  }
}
