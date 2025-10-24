import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AtendimentoChats } from './atendimento-chats.entity';

@Entity('atendimento_chat_status')
export class AtendimentoChatStatus {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'is_final', type: 'tinyint', width: 1, default: 0 })
  is_final: number;

  @OneToMany(() => AtendimentoChats, (atendimentoChats) => atendimentoChats.atendimentoChatStatus)
  atendimentoChats: AtendimentoChats[];
}
