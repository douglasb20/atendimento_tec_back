import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SupportChatMessages } from './support-chat-messages.entity';
import { SupportChatStatus } from './support-chat-status.entity';
import { Users } from 'users/entities/users.entity';
import { Channels } from 'channels/entities/channels.entity';

@Entity('support-chats')
export class SupportChats {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  user_id: number;

  @Column({ name: 'channel_id', type: 'bigint' })
  channel_id: number;

  @Column({ name: 'contact_id', type: 'int' })
  contact_id: number;

  @Column({ name: 'support_chat_status_id', type: 'int' })
  support_chat_status_id: number;

  @Column({ name: 'protocol', type: 'varchar', length: 50 })
  protocol: string;

  @Column({ name: 'last_message', type: 'text', nullable: true })
  last_message: string;

  @Column({ name: 'is_waiting', type: 'tinyint', width: 1, default: 1 })
  is_waiting: number;

  @Column({ name: 'is_read', type: 'tinyint', width: 1, default: 0 })
  is_read: number;

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    nullable: true,
    default: null,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date | null;

  // == Relationships ==
  @OneToMany(() => SupportChatMessages, (supportChatMessages) => supportChatMessages.supportChats)
  supportChatMessages: SupportChatMessages[];

  @ManyToOne(() => SupportChatStatus, (supportChatStatus) => supportChatStatus.supportChats)
  @JoinColumn({ name: 'support_chat_status_id' })
  supportChatStatus: SupportChatStatus;

  @ManyToOne(() => Users, (user) => user.supportChats)
  @JoinColumn({ name: 'user_id' })
  user: Users;

  @ManyToOne(() => Channels, (channel) => channel.supportChats)
  @JoinColumn({ name: 'channel_id' })
  channels: Channels;
}
