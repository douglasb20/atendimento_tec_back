import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { Queue } from 'bullmq';

import { Chatbots } from '@/chatbots/entities/chatbots.entity';

import { ChatbotFlowExecutions } from './entities/chatbot-flow-executions.entity';
import { ChatbotFlowExecutionJob } from './processors/chatbot-flow-execution.processor';
import { ChatbotFlowExecutionsRepository } from './chatbot-flow-executions.repository';

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
    private readonly executionsRepository: ChatbotFlowExecutionsRepository,
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
    phase: 'entrada' | 'saida' = 'entrada',
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
      phase,
    });

    this.logger.log(`Execução ${execucao.id} criada para o chatbot ${chatbot.id}`);

    return execucao;
  }

  /** Enfileira o job do motor - chamado só depois do commit. */
  async enfileirar(executionId: number, trigger: ChatbotFlowExecutionJob['trigger']): Promise<void> {
    // Identidade fixa para o início impede API e recuperação de iniciarem
    // juntos. Retomadas usam um token por espera, sem reutilizar o job inicial.
    const token = trigger.kind !== 'start' ? trigger.waitingToken : undefined;
    await this.queue.add('process', { executionId, trigger }, {
      jobId: trigger.kind === 'start' ? `inicio-${executionId}`
        : token ? `${trigger.kind}-${executionId}-${token}` : `execution-${executionId}-${randomUUID()}`,
      attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true, removeOnFail: true,
    });
  }

  @Cron('*/10 * * * * *', { waitForCompletion: true })
  async recuperarRetomadasPendentes(): Promise<void> {
    try {
      for (const execucao of await this.executionsRepository.buscarIniciosPendentes()) {
        await this.enfileirar(execucao.id, { kind: 'start' });
      }
      for (const execucao of await this.executionsRepository.buscarRetomadasPendentes()) {
        const espera = execucao.waiting_for;
        if (!espera?.token) continue;
        await this.enfileirar(execucao.id, espera.reply
          ? { kind: 'resume', waitingToken: espera.token, resumePayload: { text: espera.reply.text } }
          : { kind: 'timeout', waitingToken: espera.token });
      }
    } catch (erro) {
      this.logger.error(`Falha ao recuperar esperas do chatbot: ${erro.message}`);
    }
  }
}
