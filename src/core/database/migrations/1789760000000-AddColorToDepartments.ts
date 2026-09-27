import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Cor do setor, para diferenciá-lo visualmente nas telas que o listam (chatbot,
 * gestão de setores). Mesmo formato de `tags.color` (`#RRGGBB`).
 */
export class AddColorToDepartments1789760000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'departments',
      new TableColumn({
        name: 'color',
        type: 'varchar',
        length: '7',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('departments', 'color');
  }
}
