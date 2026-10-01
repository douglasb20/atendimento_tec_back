import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * `@lid` do contato, ao lado do `remote_jid` (telefone). O WhatsApp entrega
 * eventos ora com um, ora com outro identificador da mesma pessoa; sem guardar
 * os dois, a mensagem em `@lid` de um contato cadastrado pelo telefone criava
 * um segundo contato. O índice é parcial: a maioria dos contatos não tem LID.
 */
export class AddLidToContacts1789840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'contacts',
      new TableColumn({ name: 'lid', type: 'varchar', length: '60', isNullable: true }),
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_contacts_lid ON contacts (lid) WHERE lid IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX uq_contacts_lid');
    await queryRunner.dropColumn('contacts', 'lid');
  }
}
