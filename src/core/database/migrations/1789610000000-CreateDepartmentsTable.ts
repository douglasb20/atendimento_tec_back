import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Setores de atendimento e o vínculo com os usuários.
 *
 * Nesta entrega o setor só **agrupa pessoas**: cadastro e associação. Ele não
 * decide ainda quem vê ou atende cada conversa. É a base para o que vem depois:
 * o chatbot e a IA encaminharem a conversa para um setor, e só os atendentes
 * daquele setor poderem atendê-la.
 *
 * ⚠️ **Um usuário pode estar em vários setores** - decisão do usuário. Quem
 * cobre Suporte e Financeiro precisa aparecer para os dois; uma coluna
 * `department_id` em `users` o deixaria de fora de um deles.
 *
 * Tabela em inglês, como as demais; na tela e no código de domínio é "setor".
 */
export class CreateDepartmentsTable1789610000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'departments',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'name', type: 'varchar', length: '60', isNullable: false },
          { name: 'description', type: 'varchar', length: '255', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', isNullable: true },
          // Soft delete, como em `tags` e `integrations`: a conversa atendida
          // por um setor removido ainda precisa dizer de onde veio.
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    // Nome único entre os não removidos, sem diferença de maiúsculas: "Suporte"
    // e "suporte" são o mesmo setor. Remover libera o nome para reuso.
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_departments_name ON departments (lower(name)) WHERE deleted_at IS NULL;',
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_x_department',
        columns: [
          { name: 'user_id', type: 'int', isPrimary: true, isNullable: false },
          { name: 'department_id', type: 'int', isPrimary: true, isNullable: false },
        ],
        foreignKeys: [
          {
            name: 'userxdepartment_user_fk',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'userxdepartment_department_fk',
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

    // A PK composta cobre a busca por usuário; este índice atende o sentido
    // inverso - "quem está neste setor" -, que é o que a distribuição de
    // atendimentos vai perguntar.
    await queryRunner.query(
      'CREATE INDEX idx_user_x_department_department ON user_x_department (department_id);',
    );

    // Módulo 17, permissões 66-69: a numeração explícita das seeds continua.
    await queryRunner.query("INSERT INTO permission_module(id, nome) VALUES (17,'Setores');");

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (66, 'Visualizar setores', 17, 'department:view'), \
      (67, 'Adicionar setor', 17, 'department:add'), \
      (68, 'Alterar setor', 17, 'department:update'), \
      (69, 'Remover setor', 17, 'department:delete');",
    );

    // Só o Administrador: organizar setores é ato administrativo, ao contrário
    // do chat interno e do perfil, que valem para todos.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id BETWEEN 66 AND 69 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 66 AND 69;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 66 AND 69;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 66 AND 69;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 17;');

    await queryRunner.dropTable('user_x_department', true);
    await queryRunner.dropTable('departments', true);
  }
}
