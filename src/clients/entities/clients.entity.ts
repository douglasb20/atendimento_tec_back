import { Contacts } from 'contacts/entities/contacts.entity';
import { Supports } from 'supports/entities/supports.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Tags } from '@/tags/entities/tags.entity';
import { ClientCustomValues } from '@/custom-fields/entities/client-custom-values.entity';

@Entity('clients')
export class Clients {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 90 })
  nome: string;

  @Column({ length: 14, nullable: true, default: null })
  cnpj: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ default: 1, nullable: true })
  status: number;

  @OneToMany(() => Contacts, (contacts) => contacts.client)
  contacts: Contacts[];

  @OneToMany(() => Supports, (supports) => supports.client)
  supports: Supports[];

  /**
   * Etiquetas do cliente.
   *
   * A tabela de junção é criada pela migration (`synchronize` está desligado);
   * o `@JoinTable` apenas aponta para ela pelo nome.
   */
  @ManyToMany(() => Tags, (tag) => tag.clients)
  @JoinTable({
    name: 'client_x_tag',
    joinColumn: { name: 'client_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tags[];

  /** Campos personalizados preenchidos neste cliente. */
  @OneToMany(() => ClientCustomValues, (valor) => valor.client)
  camposPersonalizados: ClientCustomValues[];
}
