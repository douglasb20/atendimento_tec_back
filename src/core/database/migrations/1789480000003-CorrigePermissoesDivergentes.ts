import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cadastra as permissões que o código exigia sem que existissem.
 *
 * `contact:view_by_client` e `permission:view` eram usadas em `@Permissions()`
 * mas nunca haviam sido inseridas: como o guard compara pelo nome, nenhum
 * usuário jamais poderia tê-las, e os endpoints respondiam só para superusuário.
 *
 * O caso das `supports:*` (plural) é diferente e **não** se resolve aqui: o
 * banco já tem `support:*` (singular, ids 1-4), e o certo é corrigir o
 * controlador, não cadastrar o nome errado.
 *
 * Também entram os módulos e as permissões de grupos, que a tela de cadastro usa.
 * Continua a numeração explícita das seeds: `permission_module` ia até 10,
 * `permissions` até 38.
 */
export class CorrigePermissoesDivergentes1789480000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permission_module(id, nome) VALUES (11,'Permissões'), (12,'Grupos de permissão');",
    );

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (39, 'Visualizar contatos por cliente', 8, 'contact:view_by_client'), \
      (40, 'Visualizar permissões', 11, 'permission:view'), \
      (41, 'Alterar permissões', 11, 'permission:update'), \
      (42, 'Visualizar grupos', 12, 'permission_group:view'), \
      (43, 'Adicionar grupo', 12, 'permission_group:add'), \
      (44, 'Atualizar grupo', 12, 'permission_group:update'), \
      (45, 'Remover grupo', 12, 'permission_group:delete');",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 39 AND 45;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 39 AND 45;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 39 AND 45;');
    await queryRunner.query('DELETE FROM permission_module WHERE id IN (11, 12);');
  }
}
