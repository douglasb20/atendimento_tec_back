import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { ChatbotFlowGraph, ChatbotFlowVersions } from './entities/chatbot-flow-versions.entity';

/** O grafo vazio de um chatbot recém-criado: só o nó Início. */
export const GRAFO_VAZIO: ChatbotFlowGraph = {
  nodes: [{ id: 'start', type: 'start', position: { x: 0, y: 0 }, data: {} }],
  edges: [],
};

@Injectable()
export class ChatbotFlowVersionsRepository extends Repository<ChatbotFlowVersions> {
  constructor(protected dataSource: DataSource) {
    super(ChatbotFlowVersions, dataSource.manager);
  }

  async findDraft(chatbotId: number, manager?: EntityManager): Promise<ChatbotFlowVersions | null> {
    const repo = manager ? manager.getRepository(ChatbotFlowVersions) : this;

    return repo.findOne({ where: { chatbot_id: chatbotId, status: 'draft' } });
  }

  async findById(id: number, manager?: EntityManager): Promise<ChatbotFlowVersions | null> {
    const repo = manager ? manager.getRepository(ChatbotFlowVersions) : this;

    return repo.findOne({ where: { id } });
  }

  /** O maior `version_number` já usado por este chatbot (0 se nenhum). */
  async maiorVersaoUsada(chatbotId: number, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(ChatbotFlowVersions) : this;
    const ultima = await repo.findOne({
      where: { chatbot_id: chatbotId },
      order: { version_number: 'DESC' },
    });

    return ultima?.version_number ?? 0;
  }
}
