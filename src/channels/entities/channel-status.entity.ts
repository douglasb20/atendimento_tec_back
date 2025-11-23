import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Channels } from './channels.entity';

@Entity('channel_status')
export class ChannelStatus {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @OneToMany(() => Channels, (channel) => channel.channelStatus)
  channels: Channels[];
}
