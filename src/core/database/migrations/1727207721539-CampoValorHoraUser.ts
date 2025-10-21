import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampoValorHoraUser1727207721539 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` \
            ADD COLUMN `valor_hora` DECIMAL(5,2) NULL DEFAULT 0.00 AFTER `status` ',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'valor_hora');
  }
}
