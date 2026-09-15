import { Column, CreateDateColumn, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Clients } from '@/clients/entities/clients.entity';

/** Etiqueta colorida para classificar clientes. */
@Entity('tags')
export class Tags {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  /** Cor em `#RRGGBB`. O front normaliza o valor do ColorPicker, que vem sem `#`. */
  @Column({ type: 'varchar', length: 7 })
  color: string;

  /**
   * Cor do texto sobre o fundo: `light` (branco) ou `dark` (quase preto).
   *
   * É escolha de quem cadastra, não cálculo: o automático por luminância erra
   * nas cores médias, e às vezes a preferência é estética. O formulário sugere
   * um valor ao escolher a cor, e o usuário troca se quiser.
   */
  @Column({ type: 'varchar', length: 5, default: 'light' })
  text_color: 'light' | 'dark';

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
    default: null,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date | null;

  /** Soft delete, como em `integrations`. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;

  // == Relations ==

  /** Lado inverso; o `@JoinTable` fica em `Clients`. */
  @ManyToMany(() => Clients, (client) => client.tags)
  clients: Clients[];
}
