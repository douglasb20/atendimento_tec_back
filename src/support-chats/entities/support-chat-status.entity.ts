import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { SupportChats } from './support-chats.entity';

@Entity('support_chat_status')
export class SupportChatStatus {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({
    name: 'is_final',
    type: 'boolean',
    default: true,
  })
  is_final: boolean;

  @OneToMany(() => SupportChats, (supportChats) => supportChats.supportChatStatus)
  supportChats: SupportChats[];
}
