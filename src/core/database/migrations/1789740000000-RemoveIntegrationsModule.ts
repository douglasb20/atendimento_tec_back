import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove o módulo `integrations` por completo.
 *
 * O sistema decidiu que nunca coexistem duas integrações Evolution (ou dois
 * gateways WhatsApp não-oficiais) ao mesmo tempo - "canal aponta para
 * integração" deixou de fazer sentido, e a Evolution passa a ser configurada
 * por variável de ambiente (EVOLUTION_BASE_URL, EVOLUTION_API_KEY,
 * EVOLUTION_WEBHOOK_URL, EVOLUTION_WEBHOOK_SECRET).
 *
 * `instance_token` (em `channels`) é preservada: autentica cada instância na
 * Evolution e não tem relação com qual integração o canal usava.
 */
export class RemoveIntegrationsModule1789740000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) channels: solta a FK e a coluna, mantém instance_token.
    await queryRunner.query(`
      ALTER TABLE channels
      DROP CONSTRAINT IF EXISTS fk_integration_id_channels;
    `);
    await queryRunner.query(`
      ALTER TABLE channels
      DROP COLUMN IF EXISTS integration_id;
    `);

    // 2) integrations: solta índice único + FK antes de dropar a tabela.
    await queryRunner.query('DROP INDEX IF EXISTS uq_integrations_default;');
    await queryRunner.query(`
      ALTER TABLE integrations
      DROP CONSTRAINT IF EXISTS fk_integration_provider_id_integrations;
    `);
    await queryRunner.query('DROP TABLE IF EXISTS integrations;');

    // 3) catálogo de providers.
    await queryRunner.query('DROP TABLE IF EXISTS integration_providers;');

    // 4) permissões e módulo de permissão - mesma lógica do down() de
    // 1788991327973, agora como up() definitivo.
    //
    // `permission_x_user` não tem FK declarada para `permissions`
    // (1738352257503-CreatePermissionXUserTable.ts): o DELETE explícito é
    // necessário, não redundante, senão ficariam linhas órfãs.
    // `permission_group_x_permission` TEM `ON DELETE CASCADE`
    // (1789480000001-CreatePermissionGroupXPermissionTable.ts); o DELETE
    // explícito aqui é só por clareza/idempotência.
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 31 AND 34;');
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 31 AND 34;',
    );
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 31 AND 34;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 9;');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'Migration irreversível: recriar integrations/integration_providers e os dados ' +
        'perdidos exigiria o backup anterior a esta migration.',
    );
  }
}
