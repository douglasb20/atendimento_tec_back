import { randomUUID } from 'node:crypto';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  OneToMany,
  BeforeInsert,
} from 'typeorm';

import { ChannelStatus } from './channel-status.entity';
import { SupportChats } from 'support-chats/entities/support-chats.entity';
import { SupportChatMessages } from 'support-chats/messages/entities/support-chat-messages.entity';
import { Integrations } from 'integrations/entities/integrations.entity';
import { Departments } from '@/departments/entities/departments.entity';

@Entity('channels')
export class Channels {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string;

  /** Identifica a sessão no provider - na Evolution é o `instanceName`. */
  @Column({ type: 'char', length: 36, nullable: true })
  session_id: string | null;

  @Column({ type: 'int', nullable: false })
  channel_status_id: number;

  /** Integração usada por este canal. Nulo cai na integração padrão. */
  @Column({ type: 'int', nullable: true })
  integration_id: number | null;

  /** Token da própria instância, devolvido pela Evolution como `hash` no create. */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  instance_token: string | null;

  @Column({ type: 'text', nullable: true })
  qr_code: string | null;

  /**
   * Enviada sozinha quando um contato abre uma conversa nova.
   *
   * ⚠️ Nulo ou vazio = não envia. Aceita as variáveis `{{nome}}`,
   * `{{telefone}}`, `{{protocolo}}`, `{{cliente}}`, `{{canal}}` e
   * `{{saudacao}}`, trocadas no ato do envio.
   */
  @Column({ type: 'text', nullable: true })
  mensagem_saudacao: string | null;

  /** Enviada ao finalizar o atendimento. Mesmas regras da saudação. */
  @Column({ type: 'text', nullable: true })
  mensagem_despedida: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  connected_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  disconnected_at: Date | null;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;

  // == Relations ==

  @ManyToOne(() => ChannelStatus, (channelStatus) => channelStatus.channels)
  @JoinColumn({ name: 'channel_status_id' })
  channelStatus: ChannelStatus;

  @ManyToOne(() => Integrations, (integration) => integration.channels)
  @JoinColumn({ name: 'integration_id' })
  integration: Integrations;

  @OneToMany(() => SupportChats, (supportChat) => supportChat.channel)
  supportChats: SupportChats[];

  @OneToMany(() => SupportChatMessages, (supportChatMessage) => supportChatMessage.channels)
  supportChatMessages: SupportChatMessages[];

  /**
   * Os setores atendidos por este canal - pode ser mais de um, como no
   * Whaticket. Quem decide para qual setor vai cada conversa nova é o chatbot
   * por fluxo, ainda não construído; por ora é só a associação.
   *
   * A tabela vem da migration `1789620000000`; o `@JoinTable` só aponta para
   * ela.
   */
  @ManyToMany(() => Departments)
  @JoinTable({
    name: 'channel_x_department',
    joinColumn: { name: 'channel_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'department_id', referencedColumnName: 'id' },
  })
  departments: Departments[];

  @BeforeInsert()
  generateSessionId() {
    if (!this.session_id) {
      this.session_id = randomUUID().toUpperCase();
    }
  }
}
