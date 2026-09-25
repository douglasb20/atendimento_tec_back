import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Channels } from '@/channels/entities/channels.entity';
import { ChatbotFlowVersions } from './chatbot-flow-versions.entity';

export type ChatbotType = 'entrada' | 'saida' | 'agendamento' | 'complementar';

/**
 * Cadastro do chatbot: nome, tipo, canal e configurações (modal
 * "Configurações" - alerta de inatividade, redirecionar tentativas erradas,
 * acionamento por evento, gatilho de encerramento, mensagens de sistema).
 *
 * O grafo do fluxo **não vive aqui** - vive em `ChatbotFlowVersions`,
 * versionado. Ver a migration `1789630000000` para o porquê da separação.
 *
 * `type = 'complementar'`: os fluxos complementares (subfluxos, chamados pelo
 * nó "Executar Fluxo") - mesma entidade, sem `channel_id`, compartilháveis
 * entre qualquer chatbot do sistema (decisão do usuário, 23/09/2026).
 */
@Entity('chatbots')
export class Chatbots {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: ChatbotType;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', nullable: true, default: null })
  channel_id: number | null;

  @ManyToOne(() => Channels)
  @JoinColumn({ name: 'channel_id' })
  channel: Channels | null;

  /** Modal "Configurações": recursos (alertas, gatilhos) e mensagens de sistema. */
  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @Column({ type: 'bigint', nullable: true, default: null })
  current_published_version_id: number | null;

  @ManyToOne(() => ChatbotFlowVersions)
  @JoinColumn({ name: 'current_published_version_id' })
  currentPublishedVersion: ChatbotFlowVersions | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;
}
