import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Atualiza os rótulos de "Canais" para "Conexões" na tela de Grupo de
 * permissão.
 *
 * O front já foi renomeado (rota `/conexoes`, textos visíveis), mas o rótulo
 * exibido ali vem do seed do banco (`permission_module.nome` e
 * `permissions.label`), não de texto estático - por isso ficou para trás.
 * Só o texto muda: `permission_module.id = 4` e os nomes técnicos
 * (`channel:*`, `ChannelResponse` etc.) continuam os mesmos, como já decidido
 * na renomeação do front.
 */
export class RenomeiaCanaisParaConexoes1789780000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE permission_module SET nome = 'Conexões' WHERE id = 4;");

    await queryRunner.query(`
      UPDATE permissions SET label = CASE name
        WHEN 'channel:view' THEN 'Visualizar conexões'
        WHEN 'channel:add' THEN 'Adicionar conexão'
        WHEN 'channel:update' THEN 'Atualizar conexão'
        WHEN 'channel:delete' THEN 'Remover conexão'
        WHEN 'channel:config' THEN 'Configurar conexão'
        ELSE label
      END
      WHERE name IN ('channel:view', 'channel:add', 'channel:update', 'channel:delete', 'channel:config');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE permission_module SET nome = 'Canais' WHERE id = 4;");

    await queryRunner.query(`
      UPDATE permissions SET label = CASE name
        WHEN 'channel:view' THEN 'Visualizar canais'
        WHEN 'channel:add' THEN 'Adicionar canal'
        WHEN 'channel:update' THEN 'Atualizar canal'
        WHEN 'channel:delete' THEN 'Remover canal'
        WHEN 'channel:config' THEN 'Configurar canal'
        ELSE label
      END
      WHERE name IN ('channel:view', 'channel:add', 'channel:update', 'channel:delete', 'channel:config');
    `);
  }
}
