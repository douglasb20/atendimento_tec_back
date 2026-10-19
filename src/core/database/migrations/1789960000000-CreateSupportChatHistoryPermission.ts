import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissão da tela de Histórico (`/atendimentos/historico`): lista enxuta de
 * atendimentos (sem exportação, sem filtros de setor/canal/situação) com um
 * modal de detalhe por protocolo - contato, horários, relato do atendente e
 * as mensagens trocadas.
 *
 * Separada de `support.chat:view` (o chat ao vivo) de propósito: a tela de
 * Histórico é consulta, sem nenhuma ação sobre a conversa, e pode ser
 * liberada a quem audita atendimentos sem dar acesso ao chat em si.
 */
export class CreateSupportChatHistoryPermission1789960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (86, 'Ver histórico de atendimentos', 5, 'support.chat:history');",
    );

    // Sem isto, quem administra hoje não enxerga a tela nova - o grupo
    // Administrador não ganha permissões novas automaticamente.
    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 86 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 86;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 86;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 86;');
  }
}
