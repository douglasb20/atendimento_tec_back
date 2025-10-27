import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ChannelStatus } from './channel-status.entity';
import { AtendimentoChats } from 'atendimento-chat/entities/atendimento-chats.entity';
import { AtendimentoChatMessages } from 'atendimento-chat/entities/atendimento-chat-messages.entity';

@Entity('channels')
export class Channels {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
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

  @ManyToOne(() => ChannelStatus, (channelStatus) => channelStatus.channels, { eager: true })
  @JoinColumn({ name: 'channel_status_id' })
  channelStatus: ChannelStatus;

  @OneToMany(() => AtendimentoChats, (atendimentoChat) => atendimentoChat.channels)
  atendimentoChats: AtendimentoChats[];

  @OneToMany(
    () => AtendimentoChatMessages,
    (atendimentoChatMessage) => atendimentoChatMessage.channels,
  )
  atendimentoChatMessages: AtendimentoChatMessages[];
}
