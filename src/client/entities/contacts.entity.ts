import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClientsEntity } from './clients.entity';
import { AtendimentosEntity } from 'atendimentos/entities/atendimento.entity';

@Entity('contacts')
export class ContactsEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  clients_id: number;

  @Column({ type: 'varchar', length: 90, nullable: false })
  nome_contato: string;

  @Column({ type: 'varchar', length: 14, nullable: true, default: null })
  telefone_contato: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'tinyint', nullable: false, default: 1 })
  status: number;

  @ManyToOne(() => ClientsEntity, (clients) => clients.contacts)
  @JoinColumn({ name: 'clients_id', referencedColumnName: 'id' })
  clients: ClientsEntity;

  @OneToOne(() => AtendimentosEntity, (atendimentos) => atendimentos.contacts)
  // @JoinColumn({ name: 'atendimentos_id', referencedColumnName: 'id' })
  atendimentos: AtendimentosEntity;
}
