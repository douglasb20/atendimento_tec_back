import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Clients } from './clients.entity';

@Entity()
export class Contacts {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => Clients, (clients) => clients.contacts, { cascade: true })
  @JoinColumn({ name: 'clients_id' })
  clients: Clients;

  @Column({ type: 'varchar', length: 90, nullable: false })
  nome_contato: string;

  @Column({ type: 'varchar', length: 14, nullable: true, default: null })
  @JoinColumn({ name: 'clients_id' })
  telefone_contato: string;

  @Column({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'tinyint', nullable: false })
  status: number;
}
