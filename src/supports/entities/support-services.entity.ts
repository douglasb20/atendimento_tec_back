import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Supports } from './supports.entity';
import { Services } from 'service/entities/service.entity';

@Entity({ name: 'support_services' })
export class SupportServices {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'support_id', type: 'int' })
  support_id: number;

  @Column({ name: 'service_id', type: 'int' })
  service_id: number;

  @Column({ default: null, nullable: true, type: 'decimal' })
  service_fee: number;

  // ============= RELATIONS ================

  @ManyToOne(() => Supports, (support) => support.supportServices)
  @JoinColumn({ name: 'support_id' })
  supports: Supports;

  @ManyToOne(() => Services, (service) => service.supportServices)
  @JoinColumn({ name: 'service_id' })
  services: Services;
}
