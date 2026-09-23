import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Users } from '@/users/entities/users.entity';
import { InternalChatMessages } from './internal-chat-messages.entity';

/**
 * Conversa direta entre dois usuários do portal.
 *
 * ⚠️ **O par é sempre ordenado**: `user_a_id < user_b_id`, garantido por
 * constraint no banco (ver migration `1789590000000`). Quem cria uma conversa
 * deve ordenar o par antes de gravar - o repositório faz isso em
 * `findOrCreateConversa`, e é por ele que se deve passar.
 */
@Entity('internal_chats')
export class InternalChats {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  /** O **menor** dos dois ids. */
  @Column({ type: 'int' })
  user_a_id: number;

  /** O **maior** dos dois ids. */
  @Column({ type: 'int' })
  user_b_id: number;

  /**
   * Quando entrou a última mensagem.
   *
   * Desnormalizado de propósito: ordenar a lista de conversas por ele evita
   * agregar `internal_chat_messages` a cada abertura da tela. Nulo enquanto
   * ninguém escreveu.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  last_message_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_a_id' })
  userA: Users;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'user_b_id' })
  userB: Users;

  @OneToMany(() => InternalChatMessages, (mensagem) => mensagem.chat)
  messages: InternalChatMessages[];
}
