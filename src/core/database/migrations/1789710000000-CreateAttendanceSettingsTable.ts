import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Ajustes de atendimento - tela de negócio própria, separada de
 * `system_settings` (operação da API, restrita ao usuário master). Mesma
 * estrutura chave-valor: o catálogo (`attendance-settings.catalogo.ts`) é a
 * fonte de verdade do tipo e do padrão de cada chave.
 */
export class CreateAttendanceSettingsTable1789710000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'attendance_settings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'chave', type: 'varchar', length: '60', isUnique: true, isNullable: false },
          { name: 'valor', type: 'text', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_by', type: 'int', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'attendance_settings_updated_by_fk',
            columnNames: ['updated_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Módulo 19, permissão 79: a numeração explícita das seeds continua.
    await queryRunner.query(
      "INSERT INTO permission_module(id, nome) VALUES (19,'Configurações de atendimento');",
    );

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (79, 'Configurar ajustes de atendimento', 19, 'attendance_settings:manage');",
    );

    // Só o Administrador: os valores aqui valem para todos os atendentes do
    // portal - não é ajuste pessoal, é gestão de negócio.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 79 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 79;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 79;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 79;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 19;');

    await queryRunner.dropTable('attendance_settings', true);
  }
}
