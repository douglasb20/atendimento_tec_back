import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AtendimentosEntity } from './atendimento.entity';

@Entity({ name: 'atendimento_status' })
export class AtendimentoStatusEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: '25' })
  descricao: string;

  @OneToMany(() => AtendimentosEntity, (atendimentos) => atendimentos.atendimento_status)
  atendimentos: AtendimentosEntity[];
}
