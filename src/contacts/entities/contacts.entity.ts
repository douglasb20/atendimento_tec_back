import { Supports } from 'supports/entities/supports.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clients } from '../../clients/entities/clients.entity';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { ContactCustomValues } from '@/custom-fields/entities/contact-custom-values.entity';

@Entity('contacts')
export class Contacts {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', nullable: true })
  client_id: number;

  /** Primeiro nome. Vindo do webhook, é a primeira palavra do `pushName`. */
  @Column({ type: 'varchar', length: 90, nullable: false })
  name: string;

  /**
   * Sobrenome. Nulo é válido e comum: contato que é empresa ou apelido, e
   * `pushName` de uma palavra só.
   */
  @Column({ type: 'varchar', length: 90, nullable: true, default: null })
  last_name: string | null;

  @Column({ type: 'text', nullable: false })
  avatar_url: string;

  @Column({ type: 'boolean', nullable: false, default: false })
  is_avatar_external: boolean;

  /** Foto definida manualmente pelo atendente (upload) - marcado, o webhook
   * de mensagem recebida nunca mais sobrescreve `avatar_url` com a foto do
   * WhatsApp, até o atendente remover a foto manual. Distinto de
   * `is_avatar_external`, que só diz se `avatar_url` é uma URL pronta (do
   * WhatsApp) ou uma key do nosso bucket - os dois convivem: um avatar
   * manual é upload nosso, então `is_avatar_external = false`. */
  @Column({ type: 'boolean', nullable: false, default: false })
  avatar_is_manual: boolean;

  @Column({ type: 'varchar', length: 14, nullable: true, default: null })
  phone: string;

  /** Contato que nunca terá cliente associado (fornecedor, parceiro etc) -
   * marcado, finalizar atendimento com ele deixa de exigir cliente. */
  @Column({ type: 'boolean', default: false })
  has_no_client: boolean;

  /** Mensagem deste contato é descartada já no webhook - nenhum
   * `SupportChats`/`SupportChatMessages` chega a ser criado, sem
   * saudação/aviso/chatbot. Para números que nunca devem virar atendimento
   * (spam recorrente, teste interno etc). */
  @Column({ type: 'boolean', default: false })
  ignore_support: boolean;

  /** JID do contato (`5564...@s.whatsapp.net`), usado no envio e no recebimento. */
  @Column({ type: 'varchar', length: 60, nullable: false })
  remote_jid: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'smallint', nullable: false, default: 1 })
  status: number;

  @ManyToOne(() => Clients, (client) => client.contacts)
  @JoinColumn({ name: 'client_id', referencedColumnName: 'id' })
  client: Clients;

  @OneToMany(() => Supports, (support) => support.contact)
  supports: Supports[];

  @OneToMany(() => SupportChats, (supportChat) => supportChat.contact)
  supportChats: SupportChats[];

  /** Campos personalizados preenchidos neste contato. */
  @OneToMany(() => ContactCustomValues, (valor) => valor.contact)
  camposPersonalizados: ContactCustomValues[];
}
