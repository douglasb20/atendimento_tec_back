import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige as colunas que a conversão anterior deslocou em três horas.
 *
 * A migration `ConvertTimestampsToTimestamptz` tratou todas as colunas de data
 * do mesmo jeito, e elas não eram iguais: umas são preenchidas pelo **backend**
 * (que roda em `America/Sao_Paulo` e gravava horário local), outras pelo
 * **Postgres** via `CURRENT_TIMESTAMP` — e o banco está em UTC.
 *
 * Nas do backend a reinterpretação como horário de São Paulo estava certa. Nas
 * do banco, os valores já eram UTC, então converter de novo os empurrou três
 * horas para trás. Esta migration desfaz só esse excesso.
 */
const COLUNAS_COM_DEFAULT_DO_BANCO: Array<[tabela: string, coluna: string]> = [
  ['channels', 'created_at'],
  ['clients', 'created_at'],
  ['contacts', 'created_at'],
  ['integration_providers', 'created_at'],
  ['integrations', 'created_at'],
  ['log_sistema', 'datetime_request'],
  ['services', 'created_at'],
  ['support_chat_messages', 'created_at'],
  ['support_chats', 'created_at'],
  ['support_chats', 'updated_at'],
  ['users', 'created_at'],
];

/** Diferença que a conversão indevida introduziu. */
const DESLOCAMENTO = "INTERVAL '3 hours'";

export class FixTimestampsComDefaultDoBanco1789310000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tabela, coluna] of COLUNAS_COM_DEFAULT_DO_BANCO) {
      await queryRunner.query(`
        UPDATE ${tabela}
           SET ${coluna} = ${coluna} - ${DESLOCAMENTO}
         WHERE ${coluna} IS NOT NULL;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabela, coluna] of COLUNAS_COM_DEFAULT_DO_BANCO) {
      await queryRunner.query(`
        UPDATE ${tabela}
           SET ${coluna} = ${coluna} + ${DESLOCAMENTO}
         WHERE ${coluna} IS NOT NULL;
      `);
    }
  }
}
