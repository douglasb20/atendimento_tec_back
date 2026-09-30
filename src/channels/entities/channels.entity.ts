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
import { Departments } from '@/departments/entities/departments.entity';

/** Tipos de anexo aceitos, no vocabulário que o provider entende. */
export type TipoAnexoChannel = 'image' | 'video' | 'audio' | 'document';

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

  /** Token da própria instância, devolvido pela Evolution como `hash` no create. */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  instance_token: string | null;

  @Column({ type: 'text', nullable: true })
  qr_code: string | null;

  /**
   * Código de pareamento (`XXXX-XXXX`), para conectar por número de telefone
   * sem escanear QR. Mesmo caráter efêmero de `qr_code` - só um dos dois faz
   * sentido por vez, e o outro fica nulo enquanto este vale.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  pairing_code: string | null;

  /**
   * Enviada sozinha quando um contato abre uma conversa nova.
   *
   * ⚠️ Nulo ou vazio = não envia. Aceita as variáveis `{{nome}}`,
   * `{{telefone}}`, `{{protocolo}}`, `{{cliente}}`, `{{canal}}` e
   * `{{saudacao}}`, trocadas no ato do envio.
   */
  @Column({ type: 'text', nullable: true })
  mensagem_saudacao: string | null;

  /**
   * A `key` do anexo da saudação no storage, **não a URL** - como
   * `mensagem_saudacao` guarda o texto cru, sem as variáveis resolvidas.
   *
   * Fica em `channels/`, prefixo que o cron de retenção não varre: o arquivo é
   * do cadastro e precisa durar. No envio, o backend copia para `chat/media/`
   * e a mensagem referencia a cópia.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  saudacao_anexo_key: string | null;

  /** O nome original do arquivo, que o WhatsApp exibe ao destinatário. */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  saudacao_anexo_nome: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  saudacao_anexo_mimetype: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  saudacao_anexo_tipo: TipoAnexoChannel | null;

  /** Enviada ao finalizar o atendimento. Mesmas regras da saudação. */
  @Column({ type: 'text', nullable: true })
  mensagem_despedida: string | null;

  /** Anexo da despedida - independente do de saudação, mesmas regras dele. */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  despedida_anexo_key: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  despedida_anexo_nome: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  despedida_anexo_mimetype: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  despedida_anexo_tipo: TipoAnexoChannel | null;

  /** Liga a resolução automática por inatividade - desligado, os campos
   * abaixo ficam preenchidos mas inertes; o cron
   * (`InactivityResolutionService`) ignora o canal inteiro. */
  @Column({ type: 'boolean', nullable: false, default: false })
  inatividade_ativa: boolean;

  /** Minutos sem mensagem de nenhum dos dois lados até finalizar sozinho. */
  @Column({ type: 'int', nullable: true })
  inatividade_resolver_em_minutos: number | null;

  /** Minutos antes de `inatividade_resolver_em_minutos` em que o aviso é
   * enviado ao cliente - precisa ser menor que aquele. */
  @Column({ type: 'int', nullable: true })
  inatividade_avisar_em_minutos: number | null;

  /** Mensagem enviada ao cliente quando a conversa se aproxima da resolução
   * por inatividade. Mesmas variáveis de `mensagem_despedida`, sem anexo. */
  @Column({ type: 'text', nullable: true })
  inatividade_mensagem_aviso: string | null;

  /** Ao finalizar por inatividade, envia também `mensagem_despedida` -
   * opt-in: o cliente já foi avisado antes (ou nem isso, se o atraso
   * descoberto já passava do prazo de resolver), e uma segunda mensagem
   * automática pode soar redundante num encerramento por abandono. */
  @Column({ type: 'boolean', nullable: false, default: false })
  inatividade_enviar_despedida: boolean;

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
