import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Atendimentos } from './atendimento-entity';
import { Services } from 'service/entities/service.entity';

@Entity({ name: 'atendimento_servicos' })
export class AtendimentosServicos {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'id_atendimento', type: 'int' })
  id_atendimento: number;

  @Column({ name: 'id_service', type: 'int' })
  id_service: number;

  @Column({ default: null, nullable: true, type: 'decimal' })
  valor_cobrado: number;

  // ============= RELATIONS ================

  @ManyToOne(() => Atendimentos, (atendimento) => atendimento.atendimentosServicos)
  @JoinColumn({ name: 'id_atendimento' })
  atendimento: Atendimentos;

  @ManyToOne(() => Services, (service) => service.atendimentosServicos)
  @JoinColumn({ name: 'id_service' })
  service: Services;
}
