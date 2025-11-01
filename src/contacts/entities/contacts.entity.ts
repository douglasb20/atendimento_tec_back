import { Supports } from 'supports/entities/supports.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clients } from '../../clients/entities/clients.entity';

@Entity('contacts')
export class Contacts {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', nullable: true })
  client_id: number;

  @Column({ type: 'varchar', length: 90, nullable: false })
  name: string;

  @Column({ type: 'text', nullable: false })
  avatar_url: string;

  @Column({ type: 'varchar', length: 150, nullable: true, default: null })
  tags: string;

  @Column({ type: 'varchar', length: 14, nullable: true, default: null })
  phone: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  remote_jid: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'tinyint', nullable: false, default: 1 })
  status: number;

  @ManyToOne(() => Clients, (clients) => clients.contacts)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'id' })
  clients: Clients;

  @OneToMany(() => Supports, (supports) => supports.contacts)
  supports: Supports[];
}
