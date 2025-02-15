import { AtendimentosServicos } from 'atendimentos/entities/atendimento-servico-entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Services {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: '60', nullable: false })
  name: string;

  @Column({ default: null, nullable: true, type: 'decimal' })
  valor_servico: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: 1, nullable: true })
  status: number;

  // ============= RELATIONS ================

  @OneToMany(() => AtendimentosServicos, (atendimentoServico) => atendimentoServico.service)
  atendimentosServicos: AtendimentosServicos[];
}
