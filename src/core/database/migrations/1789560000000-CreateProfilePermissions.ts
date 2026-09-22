import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * O próprio perfil, separado de administrar usuários.
 *
 * `user:view` e `user:update` valem para a **tela de gerenciamento**: ver e
 * editar qualquer pessoa. Um atendente não deve enxergar o cadastro dos
 * colegas, mas precisa do próprio - trocar a senha, o avatar, corrigir o nome.
 * Eram a mesma permissão, e por isso o Perfil no menu lateral ficava escondido
 * para quase todo mundo.
 *
 * ⚠️ **Elas só funcionam com as rotas próprias** (`/users/meu-perfil`), que
 * resolvem o alvo pelo token. Apontar o Perfil para `GET /users/:id` deixaria
 * a permissão decorativa: a rota exige `user:view`, e o modal abriria vazio
 * com 403.
 *
 * Continua a numeração explícita: `permissions` ia até 57 (configurar canal).
 * O módulo 2 (Usuário) já existe.
 */
export class CreateProfilePermissions1789560000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (58, 'Visualizar próprio perfil', 2, 'user:profile_view'), \
      (59, 'Alterar próprio perfil', 2, 'user:profile_update');",
    );

    // Todos os grupos, não só o Administrador: ver e editar o próprio cadastro
    // é o piso de qualquer papel - quem atende precisa trocar a própria senha.
    // Quem não quiser pode desmarcar; o contrário (ninguém ter, e ter de
    // marcar grupo a grupo) faria a tela nascer inacessível.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE p.id BETWEEN 58 AND 59 ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 58 AND 59;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 58 AND 59;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 58 AND 59;');
  }
}
