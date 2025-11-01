import { Contacts } from 'contacts/entities/contacts.entity';
import { Supports } from 'supports/entities/supports.entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column({ type: 'timestamp', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ default: 1, nullable: true })
  status: number;

  @OneToMany(() => Contacts, (contacts) => contacts.clients)
  contacts: Contacts[];

  @OneToMany(() => Supports, (supports) => supports.clients)
  supports: Supports[];
}
