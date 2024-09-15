import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAtendimentosStatusTable1726357464159 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'atendimento_status',
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

    const hasTable = await queryRunner.hasTable('atendimento_status');

    if (hasTable) {
      await queryRunner.query(
        'INSERT INTO \
        atendimento_status(descricao) \
        values("Aberto"), \
        ("Pendente"), \
        ("Finalizado")',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('atendimento_status');
  }
}
