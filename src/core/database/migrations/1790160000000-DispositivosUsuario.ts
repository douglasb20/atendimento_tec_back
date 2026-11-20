import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Celulares com o app, para push (Fase 2b do app). Um usuário pode ter vários;
 * o token do Firebase é único e muda de dono quando outro usuário entra no
 * mesmo aparelho.
 */
export class DispositivosUsuario1790160000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_devices (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(512) NOT NULL UNIQUE,
        nome VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query('CREATE INDEX idx_user_devices_user_id ON user_devices (user_id)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE user_devices');
  }
}
