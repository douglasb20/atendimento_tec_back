import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Atendimentos } from './atendimento-entity';

@Entity({ name: 'atendimento_status' })
export class AtendimentoStatus {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: '25' })
  descricao: string;

  @OneToMany(() => Atendimentos, (atendimentos) => atendimentos.atendimento_status)
  atendimentos: Atendimentos[];
}
