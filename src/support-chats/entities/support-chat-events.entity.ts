import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Users } from 'users/entities/users.entity';
import { SupportChats } from './support-chats.entity';

/** Tipos de evento do atendimento. Por ora só a transferência. */
export enum SupportChatEventType {
  TRANSFERENCIA = 'transferencia',
}

/**
 * O que aconteceu com a conversa, fora as mensagens.
 *
 * Fica fora de `support_chat_messages` de propósito - aquela tabela espelha o
 * WhatsApp, e um evento interno não tem `message_id`, `ack` nem remetente.
 */
@Entity('support_chat_events')
export class SupportChatEvents {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ name: 'support_chat_id', type: 'bigint' })
  support_chat_id: number;

  @Column({ name: 'tipo', type: 'varchar', length: 20 })
  tipo: SupportChatEventType;

  /** Quem transferiu; nulo só se o usuário tiver sido removido depois. */
  @Column({ name: 'user_origem_id', type: 'int', nullable: true })
  user_origem_id: number | null;

  /**
   * Para quem foi.
   *
   * ⚠️ Nulo significa **devolvido para a espera**, sem destinatário - não é
   * ausência de dado.
   */
  @Column({ name: 'user_destino_id', type: 'int', nullable: true })
  user_destino_id: number | null;

  @Column({ name: 'motivo', type: 'text', nullable: true })
  motivo: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // == Relationships ==

  @ManyToOne(() => SupportChats)
  @JoinColumn({ name: 'support_chat_id' })
  supportChat: SupportChats;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_origem_id' })
  userOrigem: Users | null;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_destino_id' })
  userDestino: Users | null;
}
