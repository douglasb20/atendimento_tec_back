import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { Clients } from '@/clients/entities/clients.entity';
import { CustomFields } from './custom-fields.entity';

/** Valor de um campo personalizado num cliente. Espelha o de contatos. */
@Entity('client_custom_values')
export class ClientCustomValues {
  @PrimaryColumn({ name: 'client_id', type: 'int' })
  client_id: number;

  @PrimaryColumn({ name: 'custom_field_id', type: 'int' })
  custom_field_id: number;

  @Column({ name: 'valor', type: 'text' })
  valor: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updated_at: Date | null;

  @ManyToOne(() => Clients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Clients;

  @ManyToOne(() => CustomFields, { eager: true })
  @JoinColumn({ name: 'custom_field_id' })
  customField: CustomFields;
}
