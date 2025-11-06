import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('protocol_counters')
export class ProtocolCounters {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id: number;

  @Column({ name: 'counter', type: 'int' })
  counter: number;
}
