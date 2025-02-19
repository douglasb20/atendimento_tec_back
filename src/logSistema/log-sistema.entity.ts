import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('log_sistema')
export class LogSistema {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  rota: string;

  @Column({ type: 'int', nullable: true })
  id_usuario: number;

  @Column({ type: 'varchar', length: 10 })
  metodo: string;

  @CreateDateColumn()
  datetime_request: Date;

  @Column({ type: 'json' })
  request_data: Record<string, any>; // Armazena params, query e body

  @Column({ type: 'text' })
  queries: string;
}
