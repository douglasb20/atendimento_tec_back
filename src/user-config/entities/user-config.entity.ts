import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { Users } from '@/users/entities/users.entity';

/**
 * Uma preferência de um usuário.
 *
 * Chave-valor: o catálogo (`user-config.catalogo.ts`) é quem diz como
 * interpretar cada `valor`. Ver a migration `1789600000000` para o porquê.
 */
@Entity('user_config')
export class UserConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 60 })
  chave: string;

  /** Sempre string no banco; o catálogo converte na leitura. */
  @Column({ type: 'text' })
  valor: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  usuario: Users;
}
