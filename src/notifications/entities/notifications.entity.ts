import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notification')
export class Notifications {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'type', type: 'varchar', length: 60 })
  tipo: string;

  @Column({ name: 'title', type: 'varchar', length: 160 })
  titulo: string;

  @Column({ name: 'message', type: 'text' })
  mensagem: string;

  @Column({ name: 'data', type: 'jsonb', nullable: true, default: null })
  dados: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
