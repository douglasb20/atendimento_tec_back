import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Departments } from './departments.entity';

/**
 * Um intervalo de horário de atendimento do setor, num dia da semana. Uma
 * linha por intervalo - um dia com manhã e tarde separadas por almoço vira
 * duas linhas, não uma estrutura aninhada numa coluna só.
 */
@Entity('department_schedules')
export class DepartmentSchedules {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  department_id: number;

  @ManyToOne(() => Departments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'department_id' })
  department: Departments;

  /** 0 (domingo) .. 6 (sábado) - mesma convenção da tela de referência. */
  @Column({ type: 'smallint' })
  weekday: number;

  /** `HH:mm:ss`, como o driver do Postgres devolve para colunas `time`. */
  @Column({ type: 'time' })
  start_time: string;

  @Column({ type: 'time' })
  end_time: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
