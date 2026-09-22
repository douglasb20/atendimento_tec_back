import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converte `reaction` de `varchar(20)` para `jsonb`, um emoji por pessoa.
 *
 * A coluna guardava uma reação só, e cada evento novo sobrescrevia a anterior -
 * o WhatsApp aceita várias, uma por participante. O formato passa a ser um mapa
 * `{ "<jid de quem reagiu>": "<emoji>" }`, que é o que permite trocar e remover
 * a reação de alguém sem mexer nas outras: trocar reatribui a chave, remover a
 * apaga.
 *
 * As reações já gravadas não têm autor registrado - o `senderId` chegava no
 * payload e era descartado. Elas são preservadas sob a chave `desconhecido`,
 * para não sumirem da conversa.
 */
export class ReactionsParaJsonb1789440000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "support_chat_messages"
        ALTER COLUMN "reaction" DROP DEFAULT,
        ALTER COLUMN "reaction" TYPE jsonb
          USING CASE
            WHEN "reaction" IS NULL OR "reaction" = '' THEN '{}'::jsonb
            ELSE jsonb_build_object('desconhecido', "reaction")
          END,
        ALTER COLUMN "reaction" SET DEFAULT '{}'::jsonb
    `);

    await queryRunner.query(`
      UPDATE "support_chat_messages" SET "reaction" = '{}'::jsonb WHERE "reaction" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Na volta só cabe uma reação: fica a primeira do mapa, que é o melhor que
    // o formato antigo comporta.
    await queryRunner.query(`
      ALTER TABLE "support_chat_messages"
        ALTER COLUMN "reaction" DROP DEFAULT,
        ALTER COLUMN "reaction" TYPE varchar(20)
          USING COALESCE(
            (SELECT value FROM jsonb_each_text("reaction") LIMIT 1),
            ''
          ),
        ALTER COLUMN "reaction" SET DEFAULT ''
    `);
  }
}
