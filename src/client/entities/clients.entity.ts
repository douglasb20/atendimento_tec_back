import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Contacts } from './contacts.entity';
import { AtendimentosEntity } from 'atendimentos/entities/atendimento.entity';

@Entity('clients')
export class Clients {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 90 })
  nome: string;

  @Column({ length: 14, nullable: true, default: null })
  cnpj: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ default: 1, nullable: true })
  status: number;

  @OneToMany(() => Contacts, (contacts) => contacts.clients)
  contacts: Contacts[];

  @OneToMany(() => AtendimentosEntity, (atendimentos) => atendimentos.clients)
  atendimentos: AtendimentosEntity[];
}
