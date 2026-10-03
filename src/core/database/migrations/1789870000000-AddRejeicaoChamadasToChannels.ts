import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Rejeição automática de chamadas por canal.
 *
 * A rejeição em si é feita pela Evolution (setting `rejectCall` da instância,
 * aplicado quando o canal conecta); aqui ficam a preferência e o texto, porque
 * a gestão é nossa e o `msgCall` da Evolution **não** é usado: quem envia a
 * mensagem é o back, para poder gravá-la oculta (`hidden_at`) e manter a
 * conversa limpa - a rejeição não é diálogo, é automação.
 *
 * Tipo de evento novo em `support_chat_events` (`chamada`), sem migration: a
 * coluna `tipo` é varchar validada no código.
 */
export class AddRejeicaoChamadasToChannels1789870000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('channels', [
      new TableColumn({
        name: 'rejeitar_chamadas',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'rejeitar_chamadas_enviar_mensagem',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({ name: 'rejeitar_chamadas_mensagem', type: 'text', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('channels', 'rejeitar_chamadas_mensagem');
    await queryRunner.dropColumn('channels', 'rejeitar_chamadas_enviar_mensagem');
    await queryRunner.dropColumn('channels', 'rejeitar_chamadas');
  }
}
