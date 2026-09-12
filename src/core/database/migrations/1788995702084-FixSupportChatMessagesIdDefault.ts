import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A entidade declara `@PrimaryGeneratedColumn('uuid')`, mas a tabela foi criada
 * com `char(36)` sem valor padrão. Como o tipo não é `uuid`, o TypeORM não gera
 * o valor no insert e o banco também não - toda inserção falhava com violação
 * de NOT NULL na chave primária.
 *
 * O default no banco resolve sem exigir mudança de tipo (o que quebraria as
 * FKs que apontam para esta coluna).
 */
export class FixSupportChatMessagesIdDefault1788995702084 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await queryRunner.query(
      'ALTER TABLE support_chat_messages ALTER COLUMN id SET DEFAULT uuid_generate_v4();',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE support_chat_messages ALTER COLUMN id DROP DEFAULT;');
  }
}
