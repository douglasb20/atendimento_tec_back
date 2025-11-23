import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Supports } from './supports.entity';

@Entity({ name: 'support_status' })
export class SupportStatus {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: '25' })
  descricao: string;

  @OneToMany(() => Supports, (supports) => supports.supportStatus)
  supports: Supports[];
}
