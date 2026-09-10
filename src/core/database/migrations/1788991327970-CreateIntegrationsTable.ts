import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateIntegrationsTable1788991327970 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'integrations',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'integration_provider_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'base_url',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            // Credenciais do provider, criptografadas (AES via CRYPTO_KEY/CRYPTO_IV).
            // O formato varia por provider: a Evolution guarda { apiKey },
            // a Cloud API guardará { phoneNumberId, wabaId, accessToken }.
            name: 'credentials',
            type: 'jsonb',
            isNullable: true,
            default: null,
          },
          {
            // URL que o provider deve chamar de volta com os eventos. É uma
            // propriedade da integração (e não do ambiente) porque cada provider
            // pode exigir um endereço diferente — o backend pode estar atrás de
            // um túnel para um, e acessível por IP interno para outro.
            name: 'webhook_url',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            // Segredo próprio enviado nos headers do webhook e validado no recebimento,
            // já que o campo `apikey` do corpo da Evolution vem nulo por padrão.
            name: 'webhook_secret',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            name: 'is_default',
            type: 'boolean',
            isNullable: false,
            default: false,
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
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
            default: null,
          },
        ],
        foreignKeys: [
          {
            name: 'fk_integration_provider_id_integrations',
            columnNames: ['integration_provider_id'],
            referencedTableName: 'integration_providers',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // Garante no máximo uma integração padrão entre as não excluídas.
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_integrations_default ON integrations (is_default) \
      WHERE is_default = true AND deleted_at IS NULL;',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_integrations_default;');
    await queryRunner.dropForeignKey('integrations', 'fk_integration_provider_id_integrations');
    await queryRunner.dropTable('integrations');
  }
}
