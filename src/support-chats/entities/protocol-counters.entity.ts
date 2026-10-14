import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('protocol_counters')
export class ProtocolCounters {
  @PrimaryGeneratedColumn('increment', { type: 'int' })
  id: number;

  @Column({ name: 'counter', type: 'int' })
  counter: number;

  /**
   * O mês a que este contador pertence, como `AAAAMM`.
   *
   * Há uma linha por competência (índice único): é assim que a sequência
   * recomeça do 1 a cada mês, em vez de seguir correndo sob um prefixo novo.
   */
  @Column({ name: 'competencia', type: 'char', length: 6 })
  competencia: string;
}
