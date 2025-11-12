import { Column, Entity, Generated, JoinColumn, ManyToOne } from 'typeorm';
import { SupportChats } from '../../entities/support-chats.entity';
import { Channels } from 'channels/entities/channels.entity';
import { MessageTypes } from '@/@types';

@Entity('support_chat_messages')
export class SupportChatMessages {
  @Column({ name: 'id', type: 'char', length: 36, primary: true })
  @Generated('uuid')
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
    type: 'tinyint',
    width: 1,
    default: 0,
    transformer: {
      to: (value: boolean) => (value ? 1 : 0),
      from: (value: number) => value === 1,
    },
  })
  from_me: boolean;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string | null;

  @Column({
    name: 'has_media',
    type: 'tinyint',
    width: 1,
    default: 0,
    transformer: {
      to: (value: boolean) => (value ? 1 : 0),
      from: (value: number) => value === 1,
    },
  })
  has_media: boolean;

  @Column({ name: 'media_url', type: 'varchar', nullable: true, length: 255 })
  media_url: string | null;

  @Column({ name: 'media_type', type: 'varchar', nullable: true, length: 20 })
  media_type: string | null;

  @Column({ name: 'media_size', type: 'int', nullable: true, default: null })
  media_size: number | null;

  @Column({ name: 'from', type: 'varchar', nullable: false, length: 20 })
  from: string;

  @Column({ name: 'to', type: 'varchar', nullable: false, length: 20 })
  to: string;

  @Column({
    name: 'is_deleted',
    type: 'tinyint',
    width: 1,
    default: 0,
    transformer: {
      to: (value: boolean) => (value ? 1 : 0),
      from: (value: number) => value === 1,
    },
  })
  is_deleted: boolean;

  @Column({
    name: 'is_edited',
    type: 'tinyint',
    width: 1,
    default: 0,
    transformer: {
      to: (value: boolean) => (value ? 1 : 0),
      from: (value: number) => value === 1,
    },
  })
  is_edited: boolean;

  @Column({
    name: 'is_gif',
    type: 'tinyint',
    width: 1,
    default: 0,
    transformer: {
      to: (value: boolean) => (value ? 1 : 0),
      from: (value: number) => value === 1,
    },
  })
  is_gif: boolean;

  @Column({
    name: 'has_reaction',
    type: 'tinyint',
    width: 1,
    default: 0,
    transformer: {
      to: (value: boolean) => (value ? 1 : 0),
      from: (value: number) => value === 1,
    },
  })
  has_reaction: boolean;

  @Column({ name: 'reaction', type: 'varchar', length: 20, default: '', nullable: true })
  reaction: string;

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
