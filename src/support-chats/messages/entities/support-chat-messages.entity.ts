import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SupportChats } from '../../entities/support-chats.entity';
import { Channels } from 'channels/entities/channels.entity';
import { MessageTypes } from '@/@types';

@Entity('support_chat_messages')
export class SupportChatMessages {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'support_chat_id', type: 'bigint' })
  support_chat_id: number;

  @Column({ name: 'channel_id', type: 'bigint' })
  channel_id: number;

  @Column({ name: 'message_id', length: 50, type: 'varchar', unique: true })
  message_id: string;

  @Column({ name: 'datetime', type: 'timestamp' })
  datetime: Date;

  @Column({ name: 'ack', type: 'int' })
  ack: number;

  @Column({ name: 'type', type: 'varchar', length: 30 })
  type: MessageTypes;

  @Column({
    name: 'from_me',
    type: 'boolean',
    default: false,
  })
  from_me: boolean;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string | null;

  @Column({
    name: 'has_media',
    type: 'boolean',
    default: false,
  })
  has_media: boolean;

  @Column({ name: 'media_url', type: 'varchar', nullable: true, length: 255 })
  media_url: string | null;

  @Column({ name: 'media_type', type: 'varchar', nullable: true, length: 20 })
  media_type: string | null;

  @Column({ name: 'media_size', type: 'int', nullable: true, default: null })
  media_size: number | null;

  /**
   * Mídia removida do storage pela política de retenção. Distinto de
   * `is_deleted`: a mensagem segue válida, apenas o arquivo não está mais
   * disponível — o front deve mostrar "mídia expirada", não "mensagem apagada".
   */
  @Column({ name: 'media_expired', type: 'boolean', default: false })
  media_expired: boolean;

  @Column({ name: 'media_expired_at', type: 'timestamp', nullable: true })
  media_expired_at: Date | null;

  @Column({ name: 'has_quoted', type: 'boolean', default: false })
  has_quoted: boolean;

  @Column({ name: 'quoted_msg_id', type: 'varchar', length: 50, nullable: true })
  quoted_msg_id: string | null;

  @Column({ name: 'quoted_msg', type: 'text', nullable: true })
  quoted_msg: string | null;

  @Column({ name: 'from', type: 'varchar', nullable: false, length: 20 })
  from: string;

  @Column({ name: 'to', type: 'varchar', nullable: false, length: 20 })
  to: string;

  @Column({ name: 'device_type', type: 'varchar', nullable: false, length: 45 })
  device_type: string;

  @Column({
    name: 'is_deleted',
    type: 'boolean',
    default: false,
  })
  is_deleted: boolean;

  @Column({
    name: 'is_edited',
    type: 'boolean',
    default: false,
  })
  is_edited: boolean;

  @Column({
    name: 'is_gif',
    type: 'boolean',
    default: false,
  })
  is_gif: boolean;

  @Column({
    name: 'has_reaction',
    type: 'boolean',
    default: false,
  })
  has_reaction: boolean;

  @Column({ name: 'reaction', type: 'varchar', length: 20, default: '', nullable: true })
  reaction: string;

  @Column({ name: 'raw_payload', type: 'text', nullable: false, select: false })
  raw_payload: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;

  @ManyToOne(() => SupportChats, (supportChat) => supportChat.supportChatMessages)
  @JoinColumn({ name: 'support_chat_id' })
  supportChats: SupportChats;

  @ManyToOne(() => Channels, (channel) => channel.supportChatMessages)
  @JoinColumn({ name: 'channel_id' })
  channels: Channels;
}
