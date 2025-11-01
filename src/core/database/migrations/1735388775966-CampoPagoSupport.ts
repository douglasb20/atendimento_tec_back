import { MigrationInterface, QueryRunner } from 'typeorm';

export class CampoPagosupport1735388775966 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `supports` \
        ADD COLUMN `esta_pago` int(1) NULL DEFAULT 0 AFTER `tipo_entrada` ',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('supports', 'esta_pago');
  }
}
