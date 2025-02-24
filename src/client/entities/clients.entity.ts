import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ContactsEntity } from './contacts.entity';
import { AtendimentosEntity } from 'atendimentos/entities/atendimento.entity';

@Entity('clients')
export class ClientsEntity {
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

  @OneToMany(() => ContactsEntity, (contacts) => contacts.clients)
  contacts: ContactsEntity[];

  @OneToMany(() => AtendimentosEntity, (atendimentos) => atendimentos.clients)
  atendimentos: AtendimentosEntity[];
}
