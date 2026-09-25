import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { ChatbotFlowExecutions } from './entities/chatbot-flow-executions.entity';

@Injectable()
export class ChatbotFlowExecutionsRepository extends Repository<ChatbotFlowExecutions> {
  constructor(protected dataSource: DataSource) {
    super(ChatbotFlowExecutions, dataSource.manager);
  }

  /**
   * A execução suspensa aguardando resposta deste contato, se houver.
   *
   * Chamada a cada mensagem recebida (`onMessageCreate`) - por isso o índice
   * parcial da migration cobre exatamente este filtro.
   */
  async findSuspendedAwaitingReply(
    contactId: number,
    manager?: EntityManager,
  ): Promise<ChatbotFlowExecutions | null> {
    const repo = manager ? manager.getRepository(ChatbotFlowExecutions) : this;

    return repo
      .createQueryBuilder('e')
      .where('e.contact_id = :contactId', { contactId })
      .andWhere("e.status = 'suspended'")
      .andWhere("e.waiting_for->>'type' = 'contact_reply'")
      .getOne();
  }

  async findById(id: number, manager?: EntityManager): Promise<ChatbotFlowExecutions | null> {
    const repo = manager ? manager.getRepository(ChatbotFlowExecutions) : this;

    return repo.findOne({ where: { id } });
  }

  /**
   * Grava o novo estado com lock otimista - falha (retorna `false`) se outro
   * processo já alterou a execução entre a leitura e esta escrita. Quem chama
   * decide o que fazer com a falha (normalmente: reler e tentar de novo).
   */
  async salvarComLock(
    id: number,
    versaoLida: number,
    dados: Partial<ChatbotFlowExecutions>,
    manager: EntityManager,
  ): Promise<boolean> {
    const resultado = await manager
      .createQueryBuilder()
      .update(ChatbotFlowExecutions)
      .set({ ...dados, version: versaoLida + 1, updated_at: new Date() })
      .where('id = :id AND version = :versaoLida', { id, versaoLida })
      .execute();

    return resultado.affected === 1;
  }

  /**
   * Mesma gravação, mas lança em vez de devolver `false` - para os pontos do
   * motor em que uma falha de lock é sempre um erro de concorrência real, não
   * um caminho esperado.
   */
  async salvarComLockOuFalha(
    id: number,
    versaoLida: number,
    dados: Partial<ChatbotFlowExecutions>,
    manager: EntityManager,
  ): Promise<void> {
    const ok = await this.salvarComLock(id, versaoLida, dados, manager);

    if (!ok) {
      throw new ConflictException(`Execução ${id} foi alterada por outro processo`);
    }
  }
}
