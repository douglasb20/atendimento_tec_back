import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissão para configurar a sessão do canal: conectar, desconectar e
 * reiniciar.
 *
 * ⚠️ **Isto fecha um buraco, não só granulariza.** `start` e `terminate`
 * exigiam `channel:view` - quem pudesse *ver* a lista de canais conseguia
 * derrubar a conexão do WhatsApp, que para o atendimento de todos. Era a ação
 * mais destrutiva do módulo, sob a permissão mais fraca dele.
 *
 * `reiniciar` sai de `channel:update` e vem para cá: é a mesma natureza das
 * outras duas (mexe na sessão), e deixá-la separada faria a mesma operação -
 * derrubar e subir a conexão - depender de duas permissões diferentes.
 *
 * Sincronizar status **continua** em `channel:view`: só lê o estado real na
 * Evolution e corrige o que está gravado, sem tocar na sessão. Quem abre a
 * tela precisa dela para não ver status mentiroso.
 *
 * Continua a numeração explícita: `permissions` ia até 56. O módulo 4 (Canais)
 * já existe.
 */
export class CreateChannelConfigPermission1789550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (57, 'Configurar canal', 4, 'channel:config');",
    );

    // Sem isto quem já administra canais perderia o que fazia ontem: a
    // permissão sai de dentro de `channel:view`/`channel:update`, que ele tem.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, 57 FROM permission_groups pg \
       WHERE pg.name = 'Administrador' ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 57;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 57;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 57;');
  }
}
