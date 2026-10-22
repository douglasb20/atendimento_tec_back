import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Um feriado cadastrado - global, usado pelo nó "Feriados" do chatbot.
 *
 * Dois modos de data, por causa dos feriados móveis (Páscoa, Carnaval mudam
 * de data todo ano, diferente de Natal/Independência): `recurring = true`
 * grava só `month`/`day` e vale para sempre; `recurring = false` grava `year`
 * também e vale só naquela data específica.
 *
 * `is_system = true`: os feriados nacionais fixos, gravados pelo seed da
 * migration `1789900000000` - o nome pode ser editado, mas data e exclusão
 * são bloqueadas pelo `HolidaysService` (ver lá). Os feriados móveis
 * (Carnaval, Sexta-feira Santa, Corpus Christi) ficam de fora do seed e
 * entram como cadastro livre do usuário, com `is_system = false`.
 */
@Entity('holidays')
export class Holidays {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'boolean', default: false })
  recurring: boolean;

  @Column({ type: 'boolean', default: false })
  is_system: boolean;

  @Column({ type: 'int', nullable: true, default: null })
  year: number | null;

  @Column({ type: 'smallint' })
  month: number;

  @Column({ type: 'smallint' })
  day: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;
}
