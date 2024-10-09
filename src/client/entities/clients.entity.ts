import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Contacts } from './contacts.entity';
import { Atendimentos } from 'atendimentos/entities/atendimento-entity';

@Entity()
export class Clients {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 90 })
  nome: string;

  @Column({ length: 14, nullable: true, default: null })
  cnpj: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: 1, nullable: true })
  status: number;

  @OneToMany(() => Contacts, (contacts) => contacts.clients)
  contacts: Contacts[];

  @OneToMany(() => Atendimentos, (atendimentos) => atendimentos.clients)
  atendimentos: Atendimentos[];
}
