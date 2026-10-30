import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { Queue } from 'bullmq';

import { Chatbots } from '@/chatbots/entities/chatbots.entity';

import { ChatbotFlowExecutions } from './entities/chatbot-flow-executions.entity';
import { ChatbotFlowExecutionJob } from './processors/chatbot-flow-execution.processor';

/**
 * A ponte entre `SupportChatsService` (que decide, ao processar uma
 * mensagem, se um chatbot deve agir) e o motor de execução em si. Mantém o
 * gancho em `onMessageCreate` pequeno - ele só chama estes dois métodos.
 */
@Injectable()
export class ChatbotFlowExecutionsService {
  private readonly logger = new Logger(ChatbotFlowExecutionsService.name);

  constructor(
    @InjectQueue('chatbot-flow-execution') private readonly queue: Queue<ChatbotFlowExecutionJob>,
  ) {}

  /**
   * Cria a execução para uma conversa nova, dentro da transação já aberta
   * pelo `onMessageCreate` - o commit e o enfileiramento continuam
   * responsabilidade de quem chama (mesmo padrão da saudação automática).
   */
  async iniciar(
    contactId: number,
    supportChatId: number,
    chatbot: Chatbots,
    manager: EntityManager,
  ): Promise<ChatbotFlowExecutions> {
    if (!chatbot.current_published_version_id) {
      throw new Error(`Chatbot ${chatbot.id} não tem versão publicada`);
    }

    const execucao = await manager.save(ChatbotFlowExecutions, {
      contact_id: contactId,
      support_chat_id: supportChatId,
      chatbot_id: chatbot.id,
      flow_version_id: chatbot.current_published_version_id,
      current_flow_version_id: chatbot.current_published_version_id,
      status: 'running',
    });

    this.logger.log(`Execução ${execucao.id} criada para o chatbot ${chatbot.id}`);

    return execucao;
  }

  /** Enfileira o job do motor - chamado só depois do commit. */
  async enfileirar(executionId: number, trigger: ChatbotFlowExecutionJob['trigger']): Promise<void> {
    // O BullMQ recusa `:` e não adiciona outro job com um id que já foi
    // concluído. Uma mesma execução tem, no mínimo, um job de início e outro
    // a cada resposta do contato; por isso cada disparo precisa de um id
    // próprio. Duplicatas de webhook continuam seguras: o motor encontra a
    // execução já concluída/suspensa em outro nó e ignora o job excedente.
    await this.queue.add('process', { executionId, trigger }, { jobId: `execution-${executionId}-${randomUUID()}` });
  }
}
