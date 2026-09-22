import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Users } from '@/users/entities/users.entity';

/** Um pedido de redefinição de senha, válido uma vez só e por prazo curto. */
@Entity('password_resets')
export class PasswordResets {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  /**
   * SHA-256 do token, em hexadecimal.
   *
   * O token em claro nunca é gravado: se esta tabela vazar, os links não
   * servem para nada.
   */
  @Column({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  /** Preenchido ao consumir o pedido - é o que impede o reuso do link. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  used_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: Users;
}
