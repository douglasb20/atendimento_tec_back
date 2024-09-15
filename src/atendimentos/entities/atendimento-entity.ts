import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Clients } from 'client/entities/clients.entity';
import { Users } from 'users/entities/users.entity';
import { AtendimentoStatus } from './atendimento-status-entity';
import { Contacts } from 'client/entities/contacts.entity';

@Entity({ name: 'atendimentos' })
export class Atendimentos {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'clients_id', type: 'int' })
  clients_id: number;

  @Column({ name: 'contacts_id', type: 'int' })
  contacts_id: number;

  @Column({ name: 'users_id', type: 'int' })
  users_id: number;

  @Column({ name: 'data_referencia', type: 'date' })
  data_referencia: string;

  @Column({ name: 'hora_inicio', type: 'time' })
  hora_inicio: string;

  @Column({ name: 'hora_fim', type: 'time' })
  hora_fim: string;

  @Column({ type: 'text', default: null, nullable: true })
  comentario: string;

  @Column({ type: 'char', length: 1 })
  tipo_entrada: string;

  @Column({ type: 'int' })
  atendimento_status_id: number;

  @ManyToOne(() => Clients, (clients) => clients.atendimentos)
  @JoinColumn({ name: 'clients_id', referencedColumnName: 'id' })
  clients: Clients;

  @ManyToOne(() => Contacts, (contacts) => contacts.atendimentos)
  @JoinColumn({ name: 'contacts_id', referencedColumnName: 'id' })
  contacts: Contacts;

  @ManyToOne(() => Users, (users) => users.atendimentos)
  @JoinColumn({ name: 'users_id', referencedColumnName: 'id' })
  users: Users;

  @ManyToOne(() => AtendimentoStatus, (atendimento) => atendimento.atendimentos)
  @JoinColumn({ name: 'atendimento_status_id', referencedColumnName: 'id' })
  atendimento_status: AtendimentoStatus;
}