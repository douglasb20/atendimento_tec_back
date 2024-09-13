import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Clients } from './clients.entity';

@Entity()
export class Contacts extends BaseEntity{
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  clients_id: number;

  @Column({ type: 'varchar', length: 90, nullable: false })
  nome_contato: string;

  @Column({ type: 'varchar', length: 14, nullable: true, default: null })
  telefone_contato: string;

  @Column({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'tinyint', nullable: false })
  status: number;

  @ManyToOne(() => Clients, (clients) => clients.contacts)
  @JoinColumn({ name: 'clients_id', referencedColumnName: 'id' })
  clients: Clients;
}
