import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatbotsModule } from '@/chatbots/chatbots.module';
import { SupportChatsModule } from '@/support-chats/support-chats.module';
import { MessagesModule } from '@/support-chats/messages/messages.module';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';
import { StorageModule } from '@/storage/storage.module';

import { ChatbotFlowExecutionsRepository } from './chatbot-flow-executions.repository';
import { ChatbotFlowExecutionsService } from './chatbot-flow-executions.service';
import { ChatbotFlowExecutions } from './entities/chatbot-flow-executions.entity';
import { ExecutionEngine } from './execution-engine.service';
import { ConditionalHandler } from './node-handlers/conditional.handler';
import { FinishHandler } from './node-handlers/finish.handler';
import { MessageHandler } from './node-handlers/message.handler';
import { NODE_HANDLERS } from './node-handlers/node-handler.interface';
import { NodeHandlersRegistry } from './node-handlers/node-handlers.registry';
import { StartHandler } from './node-handlers/start.handler';
import { ChatbotFlowExecutionProcessor } from './processors/chatbot-flow-execution.processor';

/**
 * O motor de execução (runtime) - depende de `chatbots` (para ler o cadastro
 * e as versões do fluxo), não o contrário, então sem `forwardRef`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatbotFlowExecutions]),
    BullModule.registerQueue({ name: 'chatbot-flow-execution' }),
    ChatbotsModule,
    forwardRef(() => SupportChatsModule),
    MessagesModule,
    forwardRef(() => WhatsappModule),
    StorageModule,
  ],
  providers: [
    ChatbotFlowExecutionsRepository,
    ChatbotFlowExecutionsService,
    ExecutionEngine,
    NodeHandlersRegistry,
    ChatbotFlowExecutionProcessor,
    StartHandler,
    MessageHandler,
    ConditionalHandler,
    FinishHandler,
    {
      provide: NODE_HANDLERS,
      useFactory: (
        start: StartHandler,
        message: MessageHandler,
        conditional: ConditionalHandler,
        finish: FinishHandler,
      ) => [start, message, conditional, finish],
      inject: [StartHandler, MessageHandler, ConditionalHandler, FinishHandler],
    },
  ],
  exports: [ChatbotFlowExecutionsService, ChatbotFlowExecutionsRepository],
})
export class ChatbotEngineModule {}
