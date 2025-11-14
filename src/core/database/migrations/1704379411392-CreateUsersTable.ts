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
            name: 'valor_hora',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0.0,
          },
          {
            name: 'avatar_url',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'is_requestpassword',
            type: 'tinyint',
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
          {
            name: 'role',
            type: 'varchar',
            length: '10',
            isNullable: false,
            default: "'USER'",
          },
          {
            name: 'is_superuser',
            type: 'tinyint',
            length: '1',
            default: '0',
          },
          {
            name: 'status',
            type: 'tinyint',
            length: '1',
            default: '1',
          },
        ],
      }),
      true,
    );
    await queryRunner.query(
      "INSERT INTO \
      users(name, email, password, avatar_url, role, is_superuser) \
      values('Douglas', 'douglasdev.cn@gmail.com', '$2b$10$u02d66.IaHqUuJ3p42qQF.xrS1VjX3DWwVOTat/zMBu2lzzBFp0Ly', 'user/avatar/190e5e96-c03c-4c78-a0af-1c5c1c977956.jpeg', 'ADMIN', 1)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
