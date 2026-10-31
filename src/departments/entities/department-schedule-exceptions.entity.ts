import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Departments } from './departments.entity';
import { Holidays } from '@/holidays/entities/holidays.entity';

export type ModoExcecao = 'fechado' | 'normal' | 'especial';
export type IntervaloExcecao = { start_time: string; end_time: string };

@Entity('department_schedule_exceptions')
@Unique(['department_id', 'date'])
export class DepartmentScheduleExceptions {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  department_id: number;

  @ManyToOne(() => Departments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Departments;

  /** Data específica, sem conversão para UTC e sem recorrência implícita. */
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'varchar', length: 120 })
  description: string;

  @Column({ type: 'varchar', length: 12 })
  mode: ModoExcecao;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  intervals: IntervaloExcecao[];

  /** Referência à escolha no cadastro; a data da exceção permanece um registro próprio. */
  @Column({ type: 'int', nullable: true })
  holiday_id: number | null;

  @ManyToOne(() => Holidays, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'holiday_id' })
  holiday: Holidays | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
