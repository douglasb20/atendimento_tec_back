import { SupportServices } from 'supports/entities/support-services.entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity('services')
export class Services {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: '60', nullable: false })
  name: string;

  @Column({ default: null, nullable: true, type: 'decimal' })
  service_price: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ default: 1, nullable: true })
  status: number;

  // ============= RELATIONS ================

  @OneToMany(() => SupportServices, (supportServices) => supportServices.services)
  supportServices: SupportServices[];
}
