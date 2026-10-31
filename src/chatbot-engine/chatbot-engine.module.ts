import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatbotsModule } from '@/chatbots/chatbots.module';
import { HolidaysModule } from '@/holidays/holidays.module';
import { DepartmentsModule } from '@/departments/departments.module';
import { SupportChatsModule } from '@/support-chats/support-chats.module';
import { MessagesModule } from '@/support-chats/messages/messages.module';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';
import { StorageModule } from '@/storage/storage.module';

import { ChatbotFlowExecutionsRepository } from './chatbot-flow-executions.repository';
import { ChatbotFlowExecutionsService } from './chatbot-flow-executions.service';
import { ChatbotFlowExecutions } from './entities/chatbot-flow-executions.entity';
import { ExecutionEngine } from './execution-engine.service';
import { ConditionalHandler } from './node-handlers/conditional.handler';
import { CloseSupportChatHandler } from './node-handlers/close-support-chat.handler';
import { FinishHandler } from './node-handlers/finish.handler';
import { HolidayHandler } from './node-handlers/holiday.handler';
import { MenuHandler } from './node-handlers/menu.handler';
import { MessageHandler } from './node-handlers/message.handler';
import { NODE_HANDLERS } from './node-handlers/node-handler.interface';
import { NodeHandlersRegistry } from './node-handlers/node-handlers.registry';
import { StartHandler } from './node-handlers/start.handler';
import { SetDepartmentHandler } from './node-handlers/set-department.handler';
import { BusinessHoursHandler } from './node-handlers/business-hours.handler';
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
    HolidaysModule,
    DepartmentsModule,
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
    SetDepartmentHandler,
    BusinessHoursHandler,
    MessageHandler,
    ConditionalHandler,
    CloseSupportChatHandler,
    MenuHandler,
    HolidayHandler,
    FinishHandler,
    {
      provide: NODE_HANDLERS,
      useFactory: (
        start: StartHandler,
        setDepartment: SetDepartmentHandler,
        businessHours: BusinessHoursHandler,
        message: MessageHandler,
        conditional: ConditionalHandler,
        closeSupportChat: CloseSupportChatHandler,
        menu: MenuHandler,
        holiday: HolidayHandler,
        finish: FinishHandler,
      ) => [start, setDepartment, businessHours, message, conditional, closeSupportChat, menu, holiday, finish],
      inject: [
        StartHandler,
        SetDepartmentHandler,
        BusinessHoursHandler,
        MessageHandler,
        ConditionalHandler,
        CloseSupportChatHandler,
        MenuHandler,
        HolidayHandler,
        FinishHandler,
      ],
    },
  ],
  exports: [ChatbotFlowExecutionsService, ChatbotFlowExecutionsRepository],
})
export class ChatbotEngineModule {}
