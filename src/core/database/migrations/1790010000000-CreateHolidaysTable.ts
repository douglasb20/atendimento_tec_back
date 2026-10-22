import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Cadastro global de feriados - pré-requisito do nó "Feriados" do chatbot por
 * fluxo (inventário registrado em 23/09/2026, nó ainda não implementado).
 *
 * Dois modos de data, por causa dos feriados móveis: `recurring = true`
 * grava só `month`/`day` (vale todo ano, ex. Natal); `recurring = false`
 * grava `year` também (vale só naquela data, ex. Páscoa, Carnaval - mudam de
 * data a cada ano). Global - um cadastro só para a conta inteira, sem vínculo
 * com canal/setor.
 *
 * `is_system = true`: os 9 feriados nacionais fixos, semeados abaixo. Nome
 * editável, data e exclusão bloqueadas pelo `HolidaysService`. Os móveis
 * (Carnaval, Sexta-feira Santa, Corpus Christi) ficam fora do seed - mudam de
 * data todo ano e entram como cadastro livre do usuário.
 */
export class CreateHolidaysTable1790010000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'holidays',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '120', isNullable: false },
          { name: 'recurring', type: 'boolean', default: false },
          { name: 'is_system', type: 'boolean', default: false },
          { name: 'year', type: 'int', isNullable: true },
          { name: 'month', type: 'smallint', isNullable: false },
          { name: 'day', type: 'smallint', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    // Recorrente não tem ano; não recorrente exige ano - mesma regra do DTO,
    // reforçada no banco contra gravação fora da API (migration manual, etc).
    await queryRunner.query(`
      ALTER TABLE holidays
      ADD CONSTRAINT chk_holidays_year_por_recorrencia
      CHECK (
        (recurring = true AND year IS NULL) OR
        (recurring = false AND year IS NOT NULL)
      )
    `);

    // Os 9 feriados nacionais fixos (Lei 10.607/2002 e a Constituição, mais a
    // Lei 14.759/2023 para Consciência Negra) - travados contra edição de
    // data e contra exclusão pelo `HolidaysService` (`is_system = true`).
    await queryRunner.query(`
      INSERT INTO holidays (name, recurring, is_system, month, day) VALUES
      ('Ano Novo', true, true, 1, 1),
      ('Tiradentes', true, true, 4, 21),
      ('Dia do Trabalho', true, true, 5, 1),
      ('Independência do Brasil', true, true, 9, 7),
      ('Nossa Senhora Aparecida', true, true, 10, 12),
      ('Finados', true, true, 11, 2),
      ('Proclamação da República', true, true, 11, 15),
      ('Dia da Consciência Negra', true, true, 11, 20),
      ('Natal', true, true, 12, 25);
    `);

    // Módulo 22, permissões 91-94: a numeração explícita das seeds continua
    // (20 e 21 já usados por Relatórios/Agenda, trazidos do merge com main).
    await queryRunner.query("INSERT INTO permission_module(id, nome) VALUES (22,'Feriados');");

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (91, 'Visualizar feriados', 22, 'holiday:view'), \
      (92, 'Adicionar feriado', 22, 'holiday:add'), \
      (93, 'Alterar feriado', 22, 'holiday:update'), \
      (94, 'Remover feriado', 22, 'holiday:delete');",
    );

    // Só o Administrador, mesma régua de Setores: cadastro de conta, não do
    // dia a dia do atendimento.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id BETWEEN 91 AND 94 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 91 AND 94;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 91 AND 94;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 91 AND 94;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 22;');

    await queryRunner.dropTable('holidays', true);
  }
}
