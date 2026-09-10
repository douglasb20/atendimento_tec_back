import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSupportChatStatusTable1761251472613 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'support_chat_status',
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
            type: 'boolean',
            isNullable: false,
            default: false,
          },
        ],
      }),
      true,
    );

    const hasTable = await queryRunner.hasTable('support_chat_status');
    if (hasTable) {
      await queryRunner.query(
        "INSERT INTO support_chat_status(id, name, is_final) VALUES (1,'Aguardando',false), (2,'Em andamento',false), (3,'Em fila',false), (4,'Finalizado sem resposta',true), (5,'Finalizado',true)",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('support_chat_status');
  }
}
