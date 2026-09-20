import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Ajustes do sistema, alteráveis pelo portal.
 *
 * Chave-valor em vez de uma coluna por ajuste: acrescentar um item deixa de
 * exigir migration, o que importa numa tela que cresce aos poucos. A garantia
 * de tipo que as colunas dariam fica no catálogo do código
 * (`system-settings.catalogo.ts`), que declara tipo, faixa e padrão de cada
 * chave e é conferido tanto na escrita quanto na leitura.
 *
 * A tabela nasce **vazia**. Chave ausente significa "usa o padrão do catálogo",
 * e é isso que permite acrescentar um ajuste sem tocar no banco.
 */
export class CreateSystemSettingsTable1789480000007 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'system_settings',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'chave', type: 'varchar', length: '60', isNullable: false, isUnique: true },
          // `text` e não um tipo por chave: o catálogo diz como interpretar. O
          // valor da senha de e-mail chega aqui criptografado, e cifra em hex
          // não cabe num varchar curto.
          { name: 'valor', type: 'text', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          // Quem mexeu por último. Esta tela muda o comportamento do sistema
          // inteiro: quando alguém perguntar "por que a sessão caiu em um dia?",
          // o banco responde quem alterou e quando.
          { name: 'updated_by', type: 'int', isNullable: true, default: null },
        ],
        foreignKeys: [
          {
            name: 'systemsettings_user_fk',
            columnNames: ['updated_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('system_settings', true);
  }
}
