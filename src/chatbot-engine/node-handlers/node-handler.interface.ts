import { ChatbotFlowNode } from '@/chatbots/entities/chatbot-flow-versions.entity';
import { ProviderMediaType } from '@/whatsapp/providers/whatsapp-provider.interface';
import { WaitingFor } from '../entities/chatbot-flow-executions.entity';
import { ExecutionBudget } from '../execution-budget';
import { VariableStore } from '../variable-store';

/**
 * Uma ação de I/O que só pode rodar depois do commit da transação (mesma
 * razão de `enviaMensagemAutomatica`: seria a conexão do banco presa pelo
 * tempo da rede). O handler nunca chama `WhatsappService` diretamente - só
 * descreve a ação; o `ExecutionEngine` acumula e dispara depois do commit.
 *
 * `send_media.mediaKey` pode ser a key **permanente** de um anexo cadastrado
 * no nó (`sistema/chatbot/...`) ou uma URL/base64 vinda de variável - quem
 * decide a cópia descartável para proteger do cron de retenção é o
 * `ExecutionEngine`, não o handler (é I/O, roda fora da transação).
 */
export type NodeEffect =
  | { type: 'send_text'; text: string }
  | {
      type: 'send_media';
      mediaType: ProviderMediaType;
      mediaKey: string;
      mimetype?: string;
      caption?: string;
      fileName?: string;
    };

/**
 * O que um handler devolve ao motor depois de processar um nó. O motor
 * reage só a este resultado - nunca precisa saber que tipo de nó gerou.
 */
export type NodeResult =
  | { kind: 'continue'; outputHandle: string | null; effects?: NodeEffect[] }
  | { kind: 'suspend'; waitingFor: Omit<WaitingFor, 'since'>; effects?: NodeEffect[] }
  | { kind: 'call_flow'; flowId: number }
  | { kind: 'finish'; effects?: NodeEffect[] };

export type NodeExecutionContext = {
  node: ChatbotFlowNode;
  variables: VariableStore;
  budget: ExecutionBudget;
  /** Presente só quando a execução está retomando (resume) por este nó. */
  resumePayload?: Record<string, unknown>;
};

/**
 * Um handler por tipo de nó (`type`), registrado via DI - Strategy pattern,
 * nunca um switch central. Ver `node-handlers.registry.ts`.
 */
export interface NodeHandler {
  readonly type: string;
  execute(ctx: NodeExecutionContext): Promise<NodeResult>;
}

export const NODE_HANDLERS = Symbol('NODE_HANDLERS');
