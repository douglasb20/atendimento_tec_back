import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationToChannels1788991327971 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // integration_id fica nullable: canais existentes ainda não têm integração
    // associada e passam a usar a integração padrão até serem migrados.
    await queryRunner.query(`
      ALTER TABLE channels
      ADD COLUMN integration_id INT NULL,
      ADD COLUMN instance_token VARCHAR(255) NULL,
      ADD CONSTRAINT fk_integration_id_channels
        FOREIGN KEY (integration_id) REFERENCES integrations(id)
        ON DELETE RESTRICT ON UPDATE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE channels
      DROP CONSTRAINT IF EXISTS fk_integration_id_channels;
    `);
    await queryRunner.dropColumns('channels', ['integration_id', 'instance_token']);
  }
}
