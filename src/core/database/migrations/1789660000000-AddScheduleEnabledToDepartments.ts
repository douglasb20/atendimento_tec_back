import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Switch mestre do horário de atendimento do setor - sem ele, um dia sem
 * nenhum intervalo cadastrado era interpretado como "fechado" (disparava
 * `absence_message`), o que surpreendeu o usuário ao configurar só um dia da
 * semana e deixar os outros sem tocar. Com o switch desligado, o setor volta
 * a ser sempre disponível, independente do que estiver salvo em
 * `department_schedules` - forma rápida de "pausar" sem apagar configuração.
 */
export class AddScheduleEnabledToDepartments1789660000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'departments',
      new TableColumn({
        name: 'schedule_enabled',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('departments', 'schedule_enabled');
  }
}
