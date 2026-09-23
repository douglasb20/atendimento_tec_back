import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Users } from '@/users/entities/users.entity';
import { InternalMessageType } from '../internal-chat.types';
import { InternalChats } from './internal-chats.entity';

/**
 * Uma mensagem do chat interno.
 *
 * Espelha `support_chat_messages` no que se provou útil e deixa de fora o que é
 * do WhatsApp: `ack`, `message_id` do provider, `from`/`to` como JID,
 * `device_type`, `raw_payload`.
 */
@Entity('internal_chat_messages')
export class InternalChatMessages {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  internal_chat_id: number;

  @Column({ type: 'int' })
  sender_id: number;

  @Column({ type: 'varchar', length: 20 })
  type: InternalMessageType;

  /** O texto, ou a legenda quando há mídia. */
  @Column({ type: 'text', nullable: true, default: null })
  content: string | null;

  @Column({ type: 'boolean', default: false })
  has_media: boolean;

  /**
   * ⚠️ A **key** do storage, não a URL.
   *
   * Mesma convenção de `support_chat_messages.media_url` e de
   * `users.avatar_url`. A URL pública é montada na leitura, por
   * `storageService.getPublicUrl()` - que é idempotente, então passar duas
   * vezes não estraga.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  media_url: string | null;

  /**
   * O mimetype do arquivo.
   *
   * 100 caracteres, e não os 20 de `support_chat_messages`: lá só entram tipos
   * do WhatsApp, curtos; aqui vai qualquer documento, e o de um `.docx`
   * (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
   * tem 65.
   */
  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  media_type: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  media_size: number | null;

  /** Nome original - é o que identifica um documento na conversa. */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  file_name: string | null;

  /**
   * Arquivo apagado pela retenção.
   *
   * A mensagem permanece: o front mostra "mídia expirada", que é diferente de
   * mensagem apagada. Sem essa distinção, um arquivo varrido pelo cron pareceria
   * alguém tendo removido a mensagem.
   */
  @Column({ type: 'boolean', default: false })
  media_expired: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  media_expired_at: Date | null;

  /**
   * Quando o destinatário leu. Nulo = não lida.
   *
   * É daqui que sai o contador da lista. Fica na mensagem, e não na conversa,
   * porque o que interessa é *quantas* não foram lidas - com um marcador por
   * conversa daria para saber que há algo novo, mas não quanto.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  read_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', nullable: true })
  updated_at: Date;

  @ManyToOne(() => InternalChats, (chat) => chat.messages)
  @JoinColumn({ name: 'internal_chat_id' })
  chat: InternalChats;

  @ManyToOne(() => Users)
  @JoinColumn({ name: 'sender_id' })
  sender: Users;
}
