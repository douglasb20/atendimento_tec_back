import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Contacts } from './contacts.entity';

@Entity()
export class Clients {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 90 })
  nome: string;

  @Column({ length: 14, nullable: true, default: null })
  cnpj: string;

  @OneToMany(() => Contacts, (contacts) => contacts.clients, { cascade: ['insert', 'update'] })
  contacts: Contacts[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ default: 1, nullable: true })
  status: number;
}
