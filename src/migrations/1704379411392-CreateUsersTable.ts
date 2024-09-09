import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1704379411392 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '120',
          },
          {
            name: 'password',
            type: 'varchar',
          },
          {
            name: 'status',
            type: 'int',
            default: '1',
          },
          {
            name: 'is_requestpassword',
            type: 'int',
            length: '1',
            default: '0',
            comment: 'Verifica se é pedido de nova senha',
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'lastlogin_at',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );
    await queryRunner.query(
      'INSERT INTO \
      users(name, email, password) \
      values("Douglas", "douglasdev.cn@gmail.com", "$2b$10$u02d66.IaHqUuJ3p42qQF.xrS1VjX3DWwVOTat/zMBu2lzzBFp0Ly")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
