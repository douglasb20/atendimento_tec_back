import { MigrationInterface, QueryRunner } from 'typeorm';

/** Amplia as opções de antecedência definidas para cada compromisso. */
export class AmpliarAntecedenciasLembreteAgenda1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE schedules DROP CONSTRAINT schedules_valid_reminder;');
    await queryRunner.query(
      'ALTER TABLE schedules ADD CONSTRAINT schedules_valid_reminder CHECK (reminder_minutes IN (5, 10, 15, 20, 25, 30, 60));',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE schedules DROP CONSTRAINT schedules_valid_reminder;');
    await queryRunner.query(
      'ALTER TABLE schedules ADD CONSTRAINT schedules_valid_reminder CHECK (reminder_minutes IN (10, 30, 60));',
    );
  }
}
