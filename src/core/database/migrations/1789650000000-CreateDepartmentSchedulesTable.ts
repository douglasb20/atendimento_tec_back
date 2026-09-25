import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

/**
 * Horário de atendimento do setor - decisão revertida em 24/09/2026: a
 * entidade `Departments` chegou a documentar que horário viraria só um bloco
 * do fluxo do chatbot, nunca coluna/config do setor. O usuário decidiu que o
 * setor **também** tem horário próprio, para uso geral (fora de qualquer
 * chatbot). O chatbot, quando chegar nos nós de horário, poderá referenciar
 * este cadastro em vez de duplicar a configuração.
 *
 * Uma linha por intervalo, não um jsonb monolítico no setor: "adicionar
 * horário" na tela vira literalmente inserir uma linha, sem reimplementar
 * validação de estrutura dentro de um blob json. Setor sem nenhuma linha =
 * sempre disponível (comportamento de hoje) - não é obrigatório configurar.
 */
export class CreateDepartmentSchedulesTable1789650000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'department_schedules',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'department_id', type: 'int', isNullable: false },
          // 0 (domingo) .. 6 (sábado), mesma convenção da tela de referência.
          { name: 'weekday', type: 'smallint', isNullable: false },
          { name: 'start_time', type: 'time', isNullable: false },
          { name: 'end_time', type: 'time', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
        foreignKeys: [
          {
            name: 'departmentschedules_department_fk',
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

    // "Salvar" sempre substitui todas as linhas do setor de uma vez - é a
    // consulta mais comum, junto da leitura ordenada por dia/horário.
    await queryRunner.query(
      'CREATE INDEX idx_department_schedules_department ON department_schedules (department_id);',
    );

    // Texto livre exibido fora do horário configurado - simples demais para
    // merecer tabela própria.
    await queryRunner.addColumn(
      'departments',
      new TableColumn({ name: 'absence_message', type: 'varchar', length: '500', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('departments', 'absence_message');
    await queryRunner.dropTable('department_schedules', true);
  }
}
