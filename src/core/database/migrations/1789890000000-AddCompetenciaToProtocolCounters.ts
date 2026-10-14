import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reset mensal do protocolo.
 *
 * O contador era global e nunca zerava: o prefixo `AAAAMM` mudava na virada do
 * mês, mas a sequência seguia correndo (setembro terminou em `...0000064` e
 * outubro começou em `...0000065`). O formato prometia uma contagem mensal que
 * não existia.
 *
 * A `competencia` (`AAAAMM`) passa a dizer a que mês o contador pertence -
 * quando o mês corrente não bate com ela, a sequência recomeça do 1.
 *
 * A linha existente recebe a competência do mês em que esta migration roda,
 * para a numeração deste mês continuar de onde está em vez de colidir com um
 * protocolo já emitido. Os protocolos antigos **não** são tocados: o número
 * pode ter sido anotado pelo cliente.
 */
export class AddCompetenciaToProtocolCounters1789890000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE protocol_counters
      ADD COLUMN IF NOT EXISTS competencia char(6)
    `);

    // A competência de agora, para a linha que já existe.
    await queryRunner.query(`
      UPDATE protocol_counters
      SET competencia = to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMM')
      WHERE competencia IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE protocol_counters
      ALTER COLUMN competencia SET NOT NULL
    `);

    // Uma linha por competência: é o que permite o `ON CONFLICT` do contador
    // incrementar e criar o mês novo numa consulta só, sem corrida.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_protocol_counters_competencia
      ON protocol_counters (competencia)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ux_protocol_counters_competencia`);
    await queryRunner.query(`ALTER TABLE protocol_counters DROP COLUMN IF EXISTS competencia`);
  }
}
