import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Users } from '@/users/entities/users.entity';

/**
 * Um celular com o app, para receber push.
 *
 * `token` é o endereço do aparelho no Firebase e é único: o mesmo celular com
 * outro usuário logado passa a ser desse usuário (ver `DevicesService.registrar`).
 */
@Entity('user_devices')
export class UserDevices {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'varchar', length: 512, unique: true })
  token: string;

  /** Modelo do aparelho, só para identificar. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  nome: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz' })
  last_seen_at: Date;

  @ManyToOne(() => Users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  usuario: Users;
}
