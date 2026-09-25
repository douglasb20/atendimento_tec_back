import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { ExecutionEngine, ExecutionTrigger } from '../execution-engine.service';

export type ChatbotFlowExecutionJob = {
  executionId: number;
  trigger: ExecutionTrigger;
};

/**
 * `concurrency: 1`, mesma razão de `whatsapp-messages.processor.ts`: a ordem
 * dos passos de um fluxo importa, e duas mensagens da mesma conversa
 * processadas fora de ordem quebrariam a suspensão/retomada.
 */
@Processor('chatbot-flow-execution', { concurrency: 1 })
export class ChatbotFlowExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatbotFlowExecutionProcessor.name);

  @Inject()
  private readonly executionEngine: ExecutionEngine;

  async process(job: Job<ChatbotFlowExecutionJob>): Promise<boolean> {
    const { executionId, trigger } = job.data;

    try {
      this.logger.log(`Processando execução ${executionId} (${trigger.kind})`);
      await this.executionEngine.step(executionId, trigger);
      return true;
    } catch (error) {
      this.logger.error(`Erro ao processar execução ${executionId}:`, error);
      throw error;
    }
  }
}
