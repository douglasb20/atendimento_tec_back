import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSupportsStatusTable1726357464159 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'support_status',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'descricao',
            type: 'varchar',
            length: '25',
          },
        ],
      }),
    );

    const hasTable = await queryRunner.hasTable('support_status');

    if (hasTable) {
      await queryRunner.query(
        "INSERT INTO support_status(descricao) VALUES ('Aberto'), ('Pendente'), ('Finalizado'), ('Excluído')",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('support_status');
  }
}
