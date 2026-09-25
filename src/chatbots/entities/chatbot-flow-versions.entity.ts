import { Column, CreateDateColumn, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';

import { Chatbots } from './chatbots.entity';

/** Um nó do grafo do fluxo (React Flow), com config específica por tipo em `data`. */
export type ChatbotFlowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

/** Uma ligação entre nós, endereçada por saída nomeada (`sourceHandle`). */
export type ChatbotFlowEdge = {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
};

export type ChatbotFlowGraph = {
  nodes: ChatbotFlowNode[];
  edges: ChatbotFlowEdge[];
  /**
   * Posição/zoom do canvas no momento do "Salvar" - opcional, ausente no
   * grafo vazio inicial (`GRAFO_VAZIO`) e em fluxos salvos antes deste campo
   * existir. O editor usa `VIEWPORT_PADRAO` como fallback quando não há
   * valor salvo.
   */
  viewport?: { x: number; y: number; zoom: number };
};

export type ChatbotFlowVersionStatus = 'draft' | 'published' | 'archived';

/**
 * Uma versão salva do grafo de um chatbot.
 *
 * `draft` é sempre editável e sobrescrita a cada "Salvar" - só existe uma por
 * chatbot (índice único parcial na migration). "Publicar" congela o conteúdo
 * do draft numa nova linha `published`, **nunca editada depois** - é o que
 * garante que uma execução em andamento (`ChatbotFlowExecutions.flow_version_id`)
 * nunca seja afetada por uma edição posterior do fluxo.
 */
@Entity('chatbot_flow_versions')
export class ChatbotFlowVersions {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'int' })
  chatbot_id: number;

  @ManyToOne(() => Chatbots)
  @JoinColumn({ name: 'chatbot_id' })
  chatbot: Chatbots;

  @Column({ type: 'varchar', length: 10 })
  status: ChatbotFlowVersionStatus;

  @Column({ type: 'jsonb' })
  graph: ChatbotFlowGraph;

  @Column({ type: 'int' })
  version_number: number;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  published_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
