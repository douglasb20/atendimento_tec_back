import { Clients } from '@/clients/entities/clients.entity';
import { Contacts } from '@/contacts/entities/contacts.entity';
import { Users } from '@/users/entities/users.entity';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('schedules')
export class Schedules {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'title', type: 'varchar', length: 160 })
  titulo: string;

  @Column({ name: 'description', type: 'text', nullable: true, default: null })
  observacao: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  inicio_em: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  fim_em: Date;

  @Column({ name: 'reminder_minutes', type: 'smallint', default: 30 })
  lembrete_minutos: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ type: 'int', nullable: true, default: null })
  client_id: number | null;

  @Column({ type: 'int', nullable: true, default: null })
  contact_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @ManyToOne(() => Users, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  responsavel: Users;

  @ManyToOne(() => Clients, { nullable: true })
  @JoinColumn({ name: 'client_id' })
  cliente: Clients | null;

  @ManyToOne(() => Contacts, { nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contato: Contacts | null;
}
