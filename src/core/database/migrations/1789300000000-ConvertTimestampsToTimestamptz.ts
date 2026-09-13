import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converte as colunas de data para `timestamptz`.
 *
 * As colunas eram `timestamp` sem fuso, e isso corrompia toda data exibida: o
 * backend roda em `America/Sao_Paulo` e gravava o horário local (`20:18`), mas
 * o banco está em UTC e o driver devolvia esse mesmo valor marcado como UTC
 * (`20:18Z`). O navegador então somava as três horas de diferença e mostrava
 * `23:18` — uma mensagem enviada agora aparecia no futuro.
 *
 * O `USING ... AT TIME ZONE 'America/Sao_Paulo'` reinterpreta o que já está
 * gravado como horário de São Paulo, que foi como o backend o escreveu; sem a
 * cláusula, o Postgres assumiria UTC e deslocaria todo o histórico em três
 * horas na direção errada.
 */
const COLUNAS: Array<[tabela: string, coluna: string]> = [
  ['channels', 'connected_at'],
  ['channels', 'created_at'],
  ['channels', 'deleted_at'],
  ['channels', 'disconnected_at'],
  ['channels', 'updated_at'],
  ['clients', 'created_at'],
  ['clients', 'updated_at'],
  ['contacts', 'created_at'],
  ['contacts', 'updated_at'],
  ['integration_providers', 'created_at'],
  ['integration_providers', 'updated_at'],
  ['integrations', 'created_at'],
  ['integrations', 'deleted_at'],
  ['integrations', 'updated_at'],
  ['log_sistema', 'datetime_request'],
  ['services', 'created_at'],
  ['support_chat_messages', 'created_at'],
  ['support_chat_messages', 'datetime'],
  ['support_chat_messages', 'media_expired_at'],
  ['support_chat_messages', 'updated_at'],
  ['support_chats', 'answered_at'],
  ['support_chats', 'created_at'],
  ['support_chats', 'finished_at'],
  ['support_chats', 'updated_at'],
  ['user_refresh_tokens', 'expires_at'],
  ['users', 'created_at'],
  ['users', 'lastlogin_at'],
];

const FUSO_DE_ORIGEM = 'America/Sao_Paulo';

export class ConvertTimestampsToTimestamptz1789300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabela, coluna] of COLUNAS) {
      await queryRunner.query(`
        ALTER TABLE ${tabela}
        ALTER COLUMN ${coluna} TYPE timestamptz
        USING ${coluna} AT TIME ZONE '${FUSO_DE_ORIGEM}';
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta ao formato anterior mantendo o horário local, que é como os valores
    // estavam representados antes.
    for (const [tabela, coluna] of COLUNAS) {
      await queryRunner.query(`
        ALTER TABLE ${tabela}
        ALTER COLUMN ${coluna} TYPE timestamp
        USING ${coluna} AT TIME ZONE '${FUSO_DE_ORIGEM}';
      `);
    }
  }
}
