import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clients } from 'clients/entities/clients.entity';
import { Contacts } from 'contacts/entities/contacts.entity';
import { Users } from 'users/entities/users.entity';
import { SupportStatus } from './support-status.entity';
import { SupportServices } from './support-services.entity';

@Entity({ name: 'supports' })
export class Supports {
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
  support_status_id: number;

  // ============= RELATIONS ================

  @ManyToOne(() => Clients, (client) => client.supports)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'id' })
  client: Clients;

  @ManyToOne(() => Contacts, (contact) => contact.supports)
  @JoinColumn({ name: 'contact_id', referencedColumnName: 'id' })
  contact: Contacts;

  @ManyToOne(() => Users, (user) => user.supports)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: Users;

  @ManyToOne(() => SupportStatus, (support) => support.supports)
  @JoinColumn({ name: 'support_status_id', referencedColumnName: 'id' })
  supportStatus: SupportStatus;

  @OneToMany(() => SupportServices, (supportServices) => supportServices.supports)
  supportServices: SupportServices[];
}
