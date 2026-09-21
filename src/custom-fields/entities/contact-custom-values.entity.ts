import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { Contacts } from '@/contacts/entities/contacts.entity';
import { CustomFields } from './custom-fields.entity';

/**
 * Valor de um campo personalizado num contato.
 *
 * A chave é composta: um campo aparece no máximo uma vez por contato, e isso é
 * garantido pelo banco - não só pela tela, que esconde o que já foi escolhido.
 */
@Entity('contact_custom_values')
export class ContactCustomValues {
  @PrimaryColumn({ name: 'contact_id', type: 'int' })
  contact_id: number;

  @PrimaryColumn({ name: 'custom_field_id', type: 'int' })
  custom_field_id: number;

  /** Sempre texto; o `tipo` do campo diz como interpretar. */
  @Column({ name: 'valor', type: 'text' })
  valor: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updated_at: Date | null;

  @ManyToOne(() => Contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contacts;

  /**
   * `eager` porque o valor sozinho não diz nada: quem lê precisa do nome e do
   * tipo para exibir. São poucos por contato, e a alternativa seria repetir
   * `relations` em todo ponto de leitura.
   */
  @ManyToOne(() => CustomFields, { eager: true })
  @JoinColumn({ name: 'custom_field_id' })
  customField: CustomFields;
}
