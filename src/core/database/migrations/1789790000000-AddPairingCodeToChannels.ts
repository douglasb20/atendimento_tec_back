import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Código de pareamento (`XXXX-XXXX`) para conectar via número de telefone,
 * sem escanear QR - mesmo espírito efêmero de `qr_code`: vale só enquanto a
 * conexão está pendente, e é limpo nos mesmos pontos em que `qr_code` já é.
 */
export class AddPairingCodeToChannels1789790000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'channels',
      new TableColumn({
        name: 'pairing_code',
        type: 'varchar',
        length: '20',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('channels', 'pairing_code');
  }
}
