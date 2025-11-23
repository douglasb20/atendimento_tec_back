import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateChannelStatusTable1761251449715 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'channel_status',
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
        ],
      }),
      true,
    );

    const hasTable = await queryRunner.hasTable('channel_status');
    if (hasTable) {
      await queryRunner.query(
        'INSERT INTO \
        channel_status(id,name) \
        values(1,"Desconectado"), \
        (2,"Conectando"), \
        (3,"Conectado"), \
        (4,"Sessão expirada"), \
        (5,"Excluído");',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('channel_status');
  }
}
