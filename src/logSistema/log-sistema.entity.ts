import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('log_sistema')
export class LogSistemaEntity {
  @PrimaryGeneratedColumn('increment', { unsigned: true, type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  rota: string;

  @Column({ type: 'int', nullable: true })
  user_id: number;

  @Column({ type: 'varchar', length: 10 })
  metodo: string;

  @CreateDateColumn({ type: 'timestamp' })
  datetime_request: Date;

  @Column({ type: 'json' })
  request_data: Record<string, any>; // Armazena params, query e body

  @Column({ type: 'text' })
  queries: string;
}
