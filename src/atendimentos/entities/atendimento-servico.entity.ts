import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AtendimentosEntity } from './atendimento.entity';
import { ServicesEntity } from 'service/entities/service.entity';

@Entity({ name: 'atendimento_servicos' })
export class AtendimentosServicosEntity {
  @PrimaryGeneratedColumn('increment',{unsigned: true})
  id: number;

  @Column({ name: 'atendimento_id', type: 'int' })
  atendimento_id: number;

  @Column({ name: 'service_id', type: 'int' })
  service_id: number;

  @Column({ default: null, nullable: true, type: 'decimal' })
  valor_cobrado: number;

  // ============= RELATIONS ================

  @ManyToOne(() => AtendimentosEntity, (atendimento) => atendimento.atendimentosServicos)
  @JoinColumn({ name: 'atendimento_id' })
  atendimento: AtendimentosEntity;

  @ManyToOne(() => ServicesEntity, (service) => service.atendimentosServicos)
  @JoinColumn({ name: 'service_id' })
  service: ServicesEntity;
}
