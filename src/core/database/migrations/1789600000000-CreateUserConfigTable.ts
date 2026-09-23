import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Preferências de cada usuário, alteráveis pelo próprio.
 *
 * Chave-valor pelos mesmos motivos de `system_settings`: acrescentar uma
 * preferência deixa de exigir migration, e a garantia de tipo fica no catálogo
 * do código (`user-config.catalogo.ts`), conferido na escrita e na leitura.
 *
 * ⚠️ **Não é `system_settings`.** Aquela é global e só o superusuário mexe;
 * esta é por pessoa e cada um mexe na sua. O que as separa é a coluna
 * `user_id` e o índice único composto.
 *
 * ⚠️ **Nem é cadastro.** `users` guarda quem a pessoa é - nome, e-mail, grupo,
 * status. Aqui fica o que ela *prefere*. Manter preferência em `users` fazia o
 * cadastro ganhar uma coluna a cada opção nova, e a migration do tema
 * (`1789510000000`) já registrava a intenção de separá-las quando crescessem.
 *
 * A tabela nasce **vazia**. Chave ausente significa "usa o padrão do
 * catálogo", e é isso que permite acrescentar preferência sem tocar no banco.
 */
export class CreateUserConfigTable1789600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_config',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'user_id', type: 'int', isNullable: false },
          { name: 'chave', type: 'varchar', length: '60', isNullable: false },
          // `text` e não um tipo por chave: o catálogo diz como interpretar.
          { name: 'valor', type: 'text', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
        foreignKeys: [
          {
            name: 'userconfig_user_fk',
            columnNames: ['user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            // CASCADE, e não SET NULL como em `system_settings`: preferência de
            // usuário apagado não interessa a ninguém, e sem dono a linha não
            // teria sentido.
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // Único composto: uma linha por preferência por pessoa. É o que permite o
    // `upsert` do repositório e o que impede duas linhas da mesma chave para o
    // mesmo usuário - o que faria a leitura depender da ordem.
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_user_config_chave ON user_config (user_id, chave);',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('user_config', true);
  }
}
