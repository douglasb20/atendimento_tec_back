import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AnexoAvisos1790140000000 implements MigrationInterface {
  private readonly colunas = [
    ['anexo_key', '255'], ['anexo_nome', '255'],
    ['anexo_mimetype', '100'], ['anexo_tipo', '10'],
  ].map(([name, length]) => new TableColumn({ name, length, type: 'varchar', isNullable: true }));

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('service_alerts', this.colunas);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('service_alerts', this.colunas.map(coluna => coluna.name));
  }
}
