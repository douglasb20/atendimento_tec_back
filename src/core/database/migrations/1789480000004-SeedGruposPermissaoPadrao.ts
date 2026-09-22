import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Os três grupos de permissão de fábrica.
 *
 * Existem para que o sistema seja utilizável logo depois da migration: sem
 * nenhum grupo cadastrado, todo usuário novo nasceria sem acesso a nada e
 * alguém teria que montar a primeira lista de permissões na mão.
 *
 * `is_system = true` impede a exclusão, não a edição: quem quiser um Atendente
 * com mais ou menos poder ajusta as permissões pela tela.
 *
 * As permissões são referenciadas por **nome**, não por id. As seeds anteriores
 * usaram ids explícitos, o que é frágil aqui: uma permissão renomeada ou
 * renumerada daria a este grupo o acesso errado, em silêncio.
 */
export class SeedGruposPermissaoPadrao1789480000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO permission_groups (id, name, description, is_system) VALUES
       (1, 'Administrador', 'Acesso total ao sistema', true),
       (2, 'Supervisor', 'Acompanha a operação e gerencia o cadastro, sem mexer em usuários e integrações', true),
       (3, 'Atendente', 'Atende conversas e mantém o cadastro de clientes e contatos', true);`,
    );

    // Administrador: tudo que existir, inclusive o que for cadastrado por
    // migrations futuras - daí o INSERT por seleção, em vez de uma lista.
    await queryRunner.query(
      `INSERT INTO permission_group_x_permission (permission_group_id, permission_id) SELECT 1, id FROM permissions;`,
    );

    // Supervisor: tudo menos gerir usuários e integrações. Vê a operação
    // inteira e mexe no cadastro, mas não concede acesso a ninguém nem toca nas
    // credenciais dos providers.
    await queryRunner.query(
      `INSERT INTO permission_group_x_permission (permission_group_id, permission_id)
       SELECT 2, id FROM permissions
       WHERE name NOT LIKE 'user:%'
         AND name NOT LIKE 'integration:%'
         AND name NOT LIKE 'permission_group:%'
         AND name NOT LIKE 'permission:%';`,
    );

    // Atendente: o necessário para trabalhar no chat. Conversas e mensagens por
    // inteiro; clientes e contatos sem excluir; o resto só leitura ou nada.
    await queryRunner.query(
      `INSERT INTO permission_group_x_permission (permission_group_id, permission_id)
       SELECT 3, id FROM permissions WHERE name IN (
         'support:view', 'support:add', 'support:update',
         'support.chat:view', 'support.chat:add', 'support.chat:update',
         'message:update', 'message:delete',
         'client:view', 'client:add', 'client:update',
         'contact:view', 'contact:add', 'contact:update', 'contact:view_by_client',
         'tag:view',
         'service:view',
         'channel:view'
       );`,
    );

    // O superusuário existente ganha Administrador. Ele já passa por qualquer
    // permissão pelo desvio do guard, mas sem grupo a tela mostraria "sem
    // acesso" - a interface lê as permissões, não o `is_superuser`.
    await queryRunner.query(`UPDATE users SET permission_group_id = 1 WHERE is_superuser = 1;`);

    // Reposiciona a sequência depois dos ids explícitos acima. Sem isto o
    // primeiro grupo criado pela tela tentaria o id 1 e colidiria com
    // "Administrador" - as seeds de permissão têm esse problema e ninguém notou
    // porque aquelas tabelas nunca recebem inserção pela aplicação.
    await queryRunner.query(
      `SELECT setval(pg_get_serial_sequence('permission_groups', 'id'), (SELECT MAX(id) FROM permission_groups));`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE users SET permission_group_id = NULL WHERE permission_group_id IN (1, 2, 3);');
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_group_id IN (1, 2, 3);');
    await queryRunner.query('DELETE FROM permission_groups WHERE id IN (1, 2, 3);');
  }
}
