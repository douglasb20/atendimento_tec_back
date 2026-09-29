import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Nome manual do contato - marcado, o webhook de mensagem recebida
 * (`ContactsService.findOrCreateByRemoteJid`) para de sobrescrever
 * `name`/`last_name` com o `pushName` do WhatsApp. Mesmo padrão de
 * `avatar_is_manual`.
 */
export class AddNameIsManualToContacts1789800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'contacts',
      new TableColumn({
        name: 'name_is_manual',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contacts', 'name_is_manual');
  }
}
