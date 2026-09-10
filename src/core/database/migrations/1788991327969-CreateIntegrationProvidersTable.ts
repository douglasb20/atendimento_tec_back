import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateIntegrationProvidersTable1788991327969 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'integration_providers',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '50',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    const hasTable = await queryRunner.hasTable('integration_providers');
    if (hasTable) {
      await queryRunner.query(
        "INSERT INTO integration_providers(id, name, slug, is_active) VALUES \
        (1,'Evolution API','evolution', true), \
        (2,'WhatsApp Cloud API (Meta)','meta_cloud', false), \
        (3,'WhatsApp Web JS','wwebjs', false);",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('integration_providers');
  }
}
