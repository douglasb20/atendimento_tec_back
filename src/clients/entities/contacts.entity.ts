import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clients } from './clients.entity';
import { AtendimentosEntity } from 'atendimentos/entities/atendimento.entity';

@Entity('contacts')
export class Contacts {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', nullable: true })
  client_id: number;

  @Column({ type: 'varchar', length: 90, nullable: false })
  nome_contato: string;

  @Column({ type: 'varchar', length: 14, nullable: true, default: null })
  telefone_contato: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'tinyint', nullable: false, default: 1 })
  status: number;

  @ManyToOne(() => Clients, (clients) => clients.contacts)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'id' })
  clients: Clients;

  @OneToOne(() => AtendimentosEntity, (atendimentos) => atendimentos.contacts)
  // @JoinColumn({ name: 'atendimentos_id', referencedColumnName: 'id' })
  atendimentos: AtendimentosEntity;
}
