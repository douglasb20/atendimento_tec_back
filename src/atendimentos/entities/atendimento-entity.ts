import { Clients } from 'client/entities/clients.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Users } from 'users/entities/users.entity';
import { AtendimentoStatus } from './atendimento.status-entity';

@Entity({ name: 'atendimentos' })
export class Atendimento {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'clients_id', type: 'int', length: 11 })
  clients_id: number;

  @Column({ name: 'users_id', type: 'int', length: 11 })
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

  @Column({ type: 'int', length: 1 })
  atendimento_status_id: number;

  @ManyToOne(() => Clients, (clients) => clients.atendimentos)
  @JoinColumn({ name: 'clients_id', referencedColumnName: 'id' })
  clients: Clients;

  @ManyToOne(() => Users, (users) => users.atendimentos)
  @JoinColumn({ name: 'users_id', referencedColumnName: 'id' })
  users: Users;

  @ManyToOne(() => AtendimentoStatus, (atendimento) => atendimento.atendimentos)
  @JoinColumn({ name: 'atendimento_status_id', referencedColumnName: 'id' })
  atendimento_status: AtendimentoStatus;
}
