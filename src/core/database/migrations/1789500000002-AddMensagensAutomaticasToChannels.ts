import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Saudação e despedida automáticas, por canal.
 *
 * Por canal, e não em `system_settings`: cada número atende um público, e o
 * texto que serve ao suporte não serve ao comercial. Além disso a tela de
 * ajustes do sistema é `@ApenasSuperusuario`, e quem cuida de um canal já tem
 * `channel:update` - guardar ali tiraria o texto das mãos de quem o escreve.
 *
 * `text` e não `varchar`: é mensagem escrita por gente, com emoji e quebra de
 * linha, e um limite apertado no banco só criaria erro no lugar errado. O
 * limite de tamanho é validado no DTO, onde a mensagem cabe na tela.
 *
 * ⚠️ **Nulo e vazio significam "não enviar".** É o estado dos canais que já
 * existem, e é o padrão certo: um sistema que começa a responder sozinho depois
 * de uma atualização seria uma surpresa desagradável para quem atende.
 */
export class AddMensagensAutomaticasToChannels1789500000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE channels
      ADD COLUMN mensagem_saudacao TEXT NULL,
      ADD COLUMN mensagem_despedida TEXT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('channels', ['mensagem_saudacao', 'mensagem_despedida']);
  }
}
