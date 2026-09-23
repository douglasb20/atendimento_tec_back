import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissões do chat interno: módulo 16, permissões 64-65.
 *
 * Só duas, e não o quarteto view/add/update/delete: não há cadastro a
 * administrar. `view` é "usa o chat interno" (vê os colegas e o histórico) e
 * `send` é "escreve". Separá-las permite o caso de quem acompanha mas não
 * responde; editar e apagar mensagem não existem nesta entrega.
 *
 * ⚠️ `internal.chat:view` **não** é "pode ler qualquer conversa". Quem é parte
 * da conversa é decidido na rota, comparando o usuário logado com as duas
 * pontas - sem isso, trocar o id na URL leria a conversa alheia. A permissão
 * responde "pode usar a funcionalidade", a checagem responde "esta conversa é
 * sua".
 */
export class CreateInternalChatPermissions1789590000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("INSERT INTO permission_module(id, nome) VALUES (16,'Chat interno');");

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (64, 'Usar o chat interno', 16, 'internal.chat:view'), \
      (65, 'Enviar mensagem interna', 16, 'internal.chat:send');",
    );

    // Todos os grupos, não só o Administrador - o precedente é
    // `1789560000000-CreateProfilePermissions`. Falar com um colega é piso de
    // qualquer papel: quem atende é justamente quem precisa perguntar. Nascer
    // só para o Administrador obrigaria a marcar grupo a grupo para liberar o
    // que deveria valer por padrão.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE p.id BETWEEN 64 AND 65 ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE FROM permission_group_x_permission WHERE permission_id BETWEEN 64 AND 65;',
    );
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id BETWEEN 64 AND 65;');
    await queryRunner.query('DELETE FROM permissions WHERE id BETWEEN 64 AND 65;');
    await queryRunner.query('DELETE FROM permission_module WHERE id = 16;');
  }
}
