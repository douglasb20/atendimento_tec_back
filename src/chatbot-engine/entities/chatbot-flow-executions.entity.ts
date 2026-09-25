import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Contacts } from '@/contacts/entities/contacts.entity';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { ChatbotFlowVersions } from '@/chatbots/entities/chatbot-flow-versions.entity';
import { Chatbots } from '@/chatbots/entities/chatbots.entity';

export type ChatbotFlowExecutionStatus =
  | 'running'
  | 'suspended'
  | 'completed'
  | 'failed'
  | 'aborted';

/** Um frame da pilha de chamada - resolve fluxos complementares aninhados. */
export type CallStackFrame = {
  /** O chatbot (fluxo complementar) chamado - usado na checagem de recursão. */
  chatbot_id: number;
  /** A versão publicada carregada no momento da chamada - imutável. */
  flow_version_id: number;
  /** O nó "Executar Fluxo" no fluxo pai, para onde retomar ao terminar. */
  node_id: string;
  /** A saída do nó "Executar Fluxo" a seguir, resolvida pela saída nomeada
   *  que o subfluxo devolveu (`finish` sem dado extra usa `null`). */
  return_handle: string | null;
};

export type WaitingFor = {
  type: 'contact_reply';
  node_id: string;
  since: string;
};

/**
 * O estado de uma execução de fluxo - a fonte de verdade do motor. Ver a
 * migration `1789640000000` para o porquê de cada campo.
 */
@Entity('chatbot_flow_executions')
export class ChatbotFlowExecutions {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'int' })
  contact_id: number;

  @ManyToOne(() => Contacts)
  @JoinColumn({ name: 'contact_id' })
  contact: Contacts;

  @Column({ type: 'bigint', nullable: true, default: null })
  support_chat_id: number | null;

  @ManyToOne(() => SupportChats)
  @JoinColumn({ name: 'support_chat_id' })
  supportChat: SupportChats | null;

  @Column({ type: 'int' })
  chatbot_id: number;

  @ManyToOne(() => Chatbots)
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbots;

  /** A versão raiz que iniciou a execução - nunca muda depois de criada. */
  @Column({ type: 'bigint' })
  flow_version_id: number;

  @ManyToOne(() => ChatbotFlowVersions)
  @JoinColumn({ name: 'flow_version_id' })
  flowVersion: ChatbotFlowVersions;

  /**
   * O grafo em que `current_node_id` de fato vive agora - a versão raiz
   * enquanto no fluxo principal, a versão do subfluxo enquanto dentro de um
   * "Executar Fluxo". Necessário para retomar depois de um restart do
   * processo, sem depender de nada que só existisse em memória.
   */
  @Column({ type: 'bigint' })
  current_flow_version_id: number;

  @ManyToOne(() => ChatbotFlowVersions)
  @JoinColumn({ name: 'current_flow_version_id' })
  currentFlowVersion: ChatbotFlowVersions;

  @Column({ type: 'varchar', length: 12 })
  status: ChatbotFlowExecutionStatus;

  @Column({ type: 'jsonb', default: [] })
  call_stack: CallStackFrame[];

  @Column({ type: 'jsonb', default: {} })
  variables: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  counters: Record<string, number>;

  @Column({ type: 'jsonb', nullable: true, default: null })
  waiting_for: WaitingFor | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  current_node_id: string | null;

  /** Optimistic lock - todo UPDATE do motor filtra por este campo. */
  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  finished_at: Date | null;
}
