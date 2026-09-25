import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Vínculo entre canal e setor.
 *
 * Um canal pode atender vários setores (o Whaticket permite o mesmo) - quem
 * decide qual deles recebe cada conversa nova é o chatbot por fluxo, ainda não
 * construído. Por ora a associação existe para o fluxo já ter de onde ler.
 *
 * A tabela é criada aqui, e não pelo `synchronize` (desligado): o `@JoinTable`
 * da entidade `Channels` só aponta para ela pelo nome.
 */
export class CreateChannelXDepartmentTable1789620000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'channel_x_department',
        columns: [
          { name: 'channel_id', type: 'int', isPrimary: true, isNullable: false },
          { name: 'department_id', type: 'int', isPrimary: true, isNullable: false },
        ],
        foreignKeys: [
          {
            name: 'channelxdepartment_channel_fk',
            columnNames: ['channel_id'],
            referencedTableName: 'channels',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'channelxdepartment_department_fk',
            columnNames: ['department_id'],
            referencedTableName: 'departments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // A PK composta cobre "os setores deste canal"; este índice atende o
    // sentido inverso, que o fluxo vai perguntar ao escolher para onde
    // encaminhar quem já está num setor.
    await queryRunner.query(
      'CREATE INDEX idx_channel_x_department_department ON channel_x_department (department_id);',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('channel_x_department', true);
  }
}
