import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Channels } from '@/channels/entities/channels.entity';

/**
 * Aviso temporário enviado na abertura do atendimento.
 *
 * Ver a migration `1789580000000` para o porquê de ser separado da saudação do
 * canal.
 */
@Entity('service_alerts')
export class ServiceAlerts {
  @PrimaryGeneratedColumn()
  id: number;

  /** Só para achar o aviso na lista. O cliente não o vê. */
  @Column({ type: 'varchar', length: 100 })
  titulo: string;

  /** O que vai para o WhatsApp. Aceita as variáveis de mensagem. */
  @Column({ type: 'text' })
  mensagem: string;

  @Column({ type: 'boolean', default: true })
  ativo: boolean;

  /** Nulo: vale até desligarem. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  expira_em: Date | null;

  /**
   * Os canais que recebem o aviso.
   *
   * **Vazio significa todos** - é o caso comum, e obriga menos cliques no meio
   * de um incidente.
   */
  @ManyToMany(() => Channels)
  @JoinTable({
    name: 'service_alert_x_channel',
    joinColumn: { name: 'service_alert_id' },
    inverseJoinColumn: { name: 'channel_id' },
  })
  channels: Channels[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date | null;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
