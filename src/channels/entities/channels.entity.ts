import { v4 } from 'uuid';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  BeforeInsert,
} from 'typeorm';

import { ChannelStatus } from './channel-status.entity';
import { SupportChats } from 'support-chats/entities/support-chats.entity';
import { SupportChatMessages } from 'support-chats/entities/support-chat-messages.entity';

@Entity('channels')
export class Channels {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string;

  @Column({ type: 'char', length: 36, nullable: true })
  session_id: string | null;

  @Column({ type: 'int', nullable: false })
  channel_status_id: number;

  @Column({ type: 'text', nullable: true })
  qr_code: string | null;

  @Column({ type: 'timestamp', nullable: true })
  connected_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disconnected_at: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  deleted_at: Date | null;

  // == Relations ==

  @ManyToOne(() => ChannelStatus, (channelStatus) => channelStatus.channels)
  @JoinColumn({ name: 'channel_status_id' })
  channelStatus: ChannelStatus;

  @OneToMany(() => SupportChats, (supportChat) => supportChat.channels)
  supportChats: SupportChats[];

  @OneToMany(() => SupportChatMessages, (supportChatMessage) => supportChatMessage.channels)
  supportChatMessages: SupportChatMessages[];

  @BeforeInsert()
  generateSessionId() {
    if (!this.session_id) {
      this.session_id = v4().toUpperCase();
    }
  }
}
