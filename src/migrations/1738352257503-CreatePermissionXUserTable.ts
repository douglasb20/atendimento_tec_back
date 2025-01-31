import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreatePermissionXUserTable1738352257503 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'permission_x_user',
        columns: [
          {
            name: 'user_id',
            type: 'int',
          },
          {
            name: 'permission_id',
            type: 'int',
          },
        ]
      })
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('permission_x_user');
  }

}
