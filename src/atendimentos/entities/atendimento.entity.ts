import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClientsEntity } from 'client/entities/clients.entity';
import { ContactsEntity } from 'client/entities/contacts.entity';
import { UsersEntity } from 'users/entities/users.entity';
import { AtendimentoStatusEntity } from './atendimento-status.entity';
import { AtendimentosServicosEntity } from './atendimento-servico.entity';

@Entity({ name: 'atendimentos' })
export class AtendimentosEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'client_id', type: 'int' })
  client_id: number;

  @Column({ name: 'contact_id', type: 'int' })
  contact_id: number;

  @Column({ name: 'user_id', type: 'int' })
  user_id: number;

  @CreateDateColumn({ name: 'data_referencia', type: 'date' })
  data_referencia: string;

  @CreateDateColumn({ name: 'hora_inicio', type: 'time' })
  hora_inicio: string;

  @CreateDateColumn({ name: 'hora_fim', type: 'time' })
  hora_fim: string;

  @Column({ type: 'text', default: null, nullable: true })
  comentario: string; // cspell: disable-line

  @Column({ type: 'varchar', length: 1 })
  tipo_entrada: string; // T = por tempo, S = por serviço

  @Column({ type: 'int' })
  esta_pago: number;

  @Column({ type: 'int' })
  atendimento_status_id: number;

  // ============= RELATIONS ================

  @ManyToOne(() => ClientsEntity, (clients) => clients.atendimentos)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'id' })
  clients: ClientsEntity;

  @ManyToOne(() => ContactsEntity, (contacts) => contacts.atendimentos)
  @JoinColumn({ name: 'contact_id', referencedColumnName: 'id' })
  contacts: ContactsEntity;

  @ManyToOne(() => UsersEntity, (users) => users.atendimentos)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  users: UsersEntity;

  @ManyToOne(() => AtendimentoStatusEntity, (atendimento) => atendimento.atendimentos)
  @JoinColumn({ name: 'atendimento_status_id', referencedColumnName: 'id' })
  atendimento_status: AtendimentoStatusEntity;

  // ============= RELATIONS ================

  @OneToMany(() => AtendimentosServicosEntity, (atendimentoServico) => atendimentoServico.atendimento)
  atendimentosServicos: AtendimentosServicosEntity[];
}
