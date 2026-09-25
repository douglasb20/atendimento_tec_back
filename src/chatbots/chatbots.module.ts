import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StorageModule } from '@/storage/storage.module';

import { ChatbotFlowVersionsRepository } from './chatbot-flow-versions.repository';
import { ChatbotsController } from './chatbots.controller';
import { ChatbotsRepository } from './chatbots.repository';
import { ChatbotsService } from './chatbots.service';
import { ChatbotFlowVersions } from './entities/chatbot-flow-versions.entity';
import { Chatbots } from './entities/chatbots.entity';

/**
 * Cadastro administrativo do chatbot (nome, tipo, canal, configurações) e do
 * rascunho do fluxo. Não depende de fila/Redis - o motor de execução vive em
 * `chatbot-engine`, que importa este módulo (dependência unidirecional, sem
 * `forwardRef`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Chatbots, ChatbotFlowVersions]), StorageModule],
  controllers: [ChatbotsController],
  providers: [ChatbotsService, ChatbotsRepository, ChatbotFlowVersionsRepository],
  exports: [ChatbotsService, ChatbotsRepository, ChatbotFlowVersionsRepository],
})
export class ChatbotsModule {}
