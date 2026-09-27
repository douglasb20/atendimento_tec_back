import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

/**
 * Setor escolhido ao criar o atendimento pelo modal "Novo atendimento".
 *
 * Nullable: conversas abertas pelo fluxo normal (mensagem do contato via
 * webhook) não passam por setor nenhum hoje - só `criarNova` grava isto,
 * e só quando a conversa é de fato criada (`findOrOpenComSinal`), nunca
 * sobrescrevendo o setor de uma conversa já existente que for reaberta.
 */
export class AddDepartmentToSupportChats1789750000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'support_chats',
      new TableColumn({
        name: 'department_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'support_chats',
      new TableForeignKey({
        name: 'fk_department_id_support_chats',
        columnNames: ['department_id'],
        referencedTableName: 'departments',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('support_chats', 'fk_department_id_support_chats');
    await queryRunner.dropColumn('support_chats', 'department_id');
  }
}
