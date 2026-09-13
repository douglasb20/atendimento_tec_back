import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('log_sistema')
export class LogSistema {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  rota: string;

  @Column({ type: 'int', nullable: true })
  user_id: number;

  @Column({ type: 'varchar', length: 40, nullable: true, default: 'NULL' })
  ip: string;

  @Column({ type: 'varchar', length: 10 })
  metodo: string;

  @CreateDateColumn({ type: 'timestamptz' })
  datetime_request: Date;

  @Column({ type: 'jsonb' })
  request_data: Record<string, any>; // Armazena params, query e body

  @Column({ type: 'text' })
  queries: string;
}
