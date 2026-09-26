import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Avatar manual do contato - marcado, o webhook de mensagem recebida
 * (`ContactsService.findOrCreateByRemoteJid`) para de sobrescrever
 * `avatar_url` com a foto do WhatsApp. Distinto de `is_avatar_external`
 * (que só diz se a URL é pronta ou é uma key do bucket) - os dois convivem.
 */
export class AddAvatarIsManualToContacts1789680000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'contacts',
      new TableColumn({
        name: 'avatar_is_manual',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contacts', 'avatar_is_manual');
  }
}
