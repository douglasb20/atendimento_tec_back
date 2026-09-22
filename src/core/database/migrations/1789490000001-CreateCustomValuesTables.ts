import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Valores dos campos personalizados, por contato e por cliente.
 *
 * Uma linha por valor, e não um `jsonb` na própria tabela: pesquisar contato
 * por campo personalizado é o motivo de existir o catálogo, e é aí que o jsonb
 * cobraria mais caro - exigiria índice GIN e sintaxe que o projeto não usa em
 * lugar nenhum.
 *
 * ⚠️ A PK composta é o que impede o mesmo campo duas vezes no mesmo registro.
 * A tela também impede, escondendo o que já foi escolhido; esta é a garantia
 * que não depende dela.
 *
 * ⚠️ `ON DELETE RESTRICT` no campo, e não `CASCADE`: apagar um campo do
 * catálogo não pode evaporar em silêncio o que foi preenchido em centenas de
 * contatos. O service conta os usos e recusa, como o de etiquetas já faz.
 */
export class CreateCustomValuesTables1789490000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'contact_custom_values',
        columns: [
          { name: 'contact_id', type: 'int', isPrimary: true, isNullable: false },
          { name: 'custom_field_id', type: 'int', isPrimary: true, isNullable: false },
          // Sempre texto; o `tipo` do catálogo diz como interpretar. A
          // conversão acontece no serviço, num lugar só.
          { name: 'valor', type: 'text', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'contactcustomvalue_contact_fk',
            columnNames: ['contact_id'],
            referencedTableName: 'contacts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'contactcustomvalue_field_fk',
            columnNames: ['custom_field_id'],
            referencedTableName: 'custom_fields',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'client_custom_values',
        columns: [
          { name: 'client_id', type: 'int', isPrimary: true, isNullable: false },
          { name: 'custom_field_id', type: 'int', isPrimary: true, isNullable: false },
          { name: 'valor', type: 'text', isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: true,
            default: null,
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'clientcustomvalue_client_fk',
            columnNames: ['client_id'],
            referencedTableName: 'clients',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
          },
          {
            name: 'clientcustomvalue_field_fk',
            columnNames: ['custom_field_id'],
            referencedTableName: 'custom_fields',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // A PK composta já serve "quais campos este contato tem". Estes atendem o
    // sentido inverso - "quem tem este valor neste campo" -, que é a busca
    // ainda por vir, e também a contagem de usos antes de excluir um campo.
    await queryRunner.query(
      `CREATE INDEX "idx_contact_custom_values_busca" ON "contact_custom_values" ("custom_field_id", "valor")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_client_custom_values_busca" ON "client_custom_values" ("custom_field_id", "valor")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_client_custom_values_busca"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_contact_custom_values_busca"`);
    await queryRunner.dropTable('client_custom_values', true);
    await queryRunner.dropTable('contact_custom_values', true);
  }
}
