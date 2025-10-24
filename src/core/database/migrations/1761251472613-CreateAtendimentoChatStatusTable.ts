import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAtendimentoChatStatusTable1761251472613 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'atendimento_chat_status',
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
            length: '100',
            isNullable: false,
          },
          {
            name: 'is_final',
            type: 'tinyint',
            isNullable: false,
            default: 0,
          },
        ],
      }),
      true,
    );

    const hasTable = await queryRunner.hasTable('atendimento_chat_status');
    if (hasTable) {
      await queryRunner.query(
        'INSERT INTO \
        atendimento_chat_status(id,name,is_final) \
        values(1,"Aguardando", 0), \
        (2,"Em andamento", 0), \
        (3,"Em fila", 0), \
        (4,"Finalizado sem resposta", 1), \
        (5,"Finalizado", 1);',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('atendimento_chat_status');
  }
}
