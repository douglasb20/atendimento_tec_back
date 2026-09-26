import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Contato que nunca terá cliente associado (fornecedor, parceiro, contato
 * interno etc) - marcado, `finalizarAtendimento` deixa de exigir
 * `contact.client_id` para ele. Sem isso, o único caminho para encerrar um
 * atendimento com esse tipo de contato era "Finalizar sem atendimento", que
 * não registra o histórico como um atendimento de verdade.
 */
export class AddHasNoClientToContacts1789670000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'contacts',
      new TableColumn({
        name: 'has_no_client',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('contacts', 'has_no_client');
  }
}
