import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove `permission:update` (id 41) - a permissão não tinha o que proteger.
 *
 * Ela guardava `POST /permissions` e `PUT /permissions/:id`, dois endpoints que
 * **nenhuma tela chamava**. Permissão nasce por migration, com id explícito,
 * junto da funcionalidade que a exige; criá-la por API furaria justamente esse
 * controle - as seeds não ajustam a sequence, e um id vindo do banco colidiria
 * com a próxima seed.
 *
 * Os dois handlers saíram junto (controller, service, repository e os DTOs):
 * endpoint sem tela é superfície exposta sem uso.
 *
 * `permission:view` (id 40) **fica**: alimenta `GET /permissions` e
 * `GET /permissions/modules`, que a tela de grupos de permissão consome para
 * montar a lista de checkboxes.
 *
 * A 41 veio de `1789480000003`, que corrigia permissões usadas no código e
 * ausentes do seed - entrou por simetria com a `view`, não por necessidade.
 */
export class RemovePermissionUpdatePermission1789570000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 41;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 41;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 41;');
  }

  /**
   * Recria a permissão, mas **não** os endpoints - o `down` de uma migration
   * não devolve código. Voltar de verdade exige reverter o commit.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) \
       VALUES (41, 'Alterar permissões', 11, 'permission:update');",
    );

    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, 41 FROM permission_groups pg \
       WHERE pg.name = 'Administrador' ON CONFLICT DO NOTHING;",
    );
  }
}
