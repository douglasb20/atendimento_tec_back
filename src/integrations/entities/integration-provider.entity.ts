import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Integrations } from './integrations.entity';

@Entity('integration_providers')
export class IntegrationProviders {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  /** Identificador usado pela factory para resolver a implementação do provider. */
  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @OneToMany(() => Integrations, (integration) => integration.integrationProvider)
  integrations: Integrations[];
}
