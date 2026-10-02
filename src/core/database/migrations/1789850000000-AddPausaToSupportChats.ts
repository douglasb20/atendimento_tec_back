import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Pausa do atendimento.
 *
 * A pausa é um estado derivado (`paused_at` preenchido), e não um novo valor de
 * `support_chat_status_id`: dezenas de consultas e regras (visibilidade de
 * conversa alheia, não lidas, resolução por inatividade, o próprio front)
 * tratam "em atendimento" como `EM_ANDAMENTO`, e um status novo as quebraria
 * em silêncio. A conversa segue `EM_ANDAMENTO`, com dono e na mesma aba.
 *
 * `paused_total_seconds` acumula as pausas já encerradas: o cronômetro é
 * `(paused_at ?? agora) - answered_at - paused_total_seconds`, então parar e
 * retomar não perde nem inventa tempo.
 *
 * Permissão 81 (módulo 5, junto das demais `support.chat:*`): só o
 * Administrador a recebe; os demais grupos ganham pela tela de permissões.
 */
export class AddPausaToSupportChats1789850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('support_chats', [
      new TableColumn({ name: 'paused_at', type: 'timestamptz', isNullable: true }),
      new TableColumn({
        name: 'paused_total_seconds',
        type: 'int',
        isNullable: false,
        default: 0,
      }),
    ]);

    await queryRunner.query(
      "INSERT INTO permissions (id, label, permission_module_id, name) VALUES \
      (81, 'Pausar atendimento', 5, 'support.chat:pause');",
    );

    await queryRunner.query(
      "INSERT INTO permission_group_x_permission (permission_group_id, permission_id) \
       SELECT pg.id, p.id FROM permission_groups pg CROSS JOIN permissions p \
       WHERE pg.name = 'Administrador' AND p.id = 81 \
       ON CONFLICT DO NOTHING;",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM permission_group_x_permission WHERE permission_id = 81;');
    await queryRunner.query('DELETE FROM permission_x_user WHERE permission_id = 81;');
    await queryRunner.query('DELETE FROM permissions WHERE id = 81;');
    await queryRunner.dropColumn('support_chats', 'paused_total_seconds');
    await queryRunner.dropColumn('support_chats', 'paused_at');
  }
}
