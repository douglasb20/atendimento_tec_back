import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Granulariza o módulo de usuários: alterar o próprio e-mail e alterar grupo
 * de permissão viram permissões próprias.
 *
 * Até aqui o módulo tinha só o quarteto view/add/update/delete, e `user:update`
 * dava tudo de uma vez. Os dois campos separados agora são os de maior alcance:
 * o e-mail é a credencial de login, e o grupo define o que a pessoa pode fazer
 * - quem pudesse trocar o próprio grupo se promoveria sozinho.
 *
 * ⚠️ **São permissões de auto-edição.** Alterar o e-mail ou o grupo de *outro*
 * usuário continua sob `user:update`: quem administra usuários já tem esse
 * poder por definição, e exigir as duas faria um administrador não conseguir
 * promover ninguém.
 *
 * Continua a numeração explícita: `permissions` ia até 54 (respostas rápidas).
 * O módulo é o 2, que já existe - estas pertencem a Usuário, não a um módulo
 * novo.
 */
export class CreateUserGranularPermissions1789540000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (55, 'Alterar próprio e-mail', 2, 'user:change_own_email'), \
      (56, 'Alterar grupo de permissão', 2, 'user:change_group');",
    );

    // Sem isto quem já é administrador perderia acesso a algo que fazia ontem:
    // as duas saem de dentro do `user:update`, que ele já tem.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id BETWEEN 55 AND 56 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 55 AND 56;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 55 AND 56;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 55 AND 56;');
  }
}
