import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AtendimentosEntity } from './atendimento.entity';
import { ServicesEntity } from 'service/entities/service.entity';

@Entity({ name: 'atendimento_servicos' })
export class AtendimentosServicosEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'id_atendimento', type: 'int' })
  id_atendimento: number;

  @Column({ name: 'id_service', type: 'int' })
  id_service: number;

  @Column({ default: null, nullable: true, type: 'decimal' })
  valor_cobrado: number;

  // ============= RELATIONS ================

  @ManyToOne(() => AtendimentosEntity, (atendimento) => atendimento.atendimentosServicos)
  @JoinColumn({ name: 'id_atendimento' })
  atendimento: AtendimentosEntity;

  @ManyToOne(() => ServicesEntity, (service) => service.atendimentosServicos)
  @JoinColumn({ name: 'id_service' })
  service: ServicesEntity;
}
