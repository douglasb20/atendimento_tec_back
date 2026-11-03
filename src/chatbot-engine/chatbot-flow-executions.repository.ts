import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { ChatbotFlowExecutions } from './entities/chatbot-flow-executions.entity';

@Injectable()
export class ChatbotFlowExecutionsRepository extends Repository<ChatbotFlowExecutions> {
  /** Recupera um início cujo enfileiramento após o commit falhou. */
  async buscarIniciosPendentes(): Promise<Pick<ChatbotFlowExecutions, 'id'>[]> {
    return this.dataSource.query(`SELECT id FROM chatbot_flow_executions WHERE phase = 'saida'
      AND status = 'running' AND current_node_id IS NULL AND created_at < NOW() - INTERVAL '30 seconds'
      ORDER BY created_at LIMIT 100`);
  }
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
    supportChatId: number,
    manager?: EntityManager,
  ): Promise<ChatbotFlowExecutions | null> {
    const repo = manager ? manager.getRepository(ChatbotFlowExecutions) : this;

    return repo
      .createQueryBuilder('e')
      .where('e.contact_id = :contactId', { contactId })
      .andWhere('e.support_chat_id = :supportChatId', { supportChatId })
      .andWhere("e.status = 'suspended'")
      .andWhere("e.waiting_for->>'type' = 'contact_reply'")
      .getOne();
  }

  /** Assumir/descartar a conversa invalida também os jobs já enfileirados. */
  async abortarDoAtendimento(supportChatId: number, manager: EntityManager): Promise<void> {
    await manager.createQueryBuilder().update(ChatbotFlowExecutions)
      .set({ status: 'aborted', waiting_for: null, finished_at: new Date(),
        updated_at: new Date(), version: () => 'version + 1' })
      .where('support_chat_id = :supportChatId', { supportChatId })
      .andWhere('status IN (:...pendentes)', { pendentes: ['running', 'suspended'] })
      .execute();
  }

  async findById(id: number, manager?: EntityManager): Promise<ChatbotFlowExecutions | null> {
    const repo = manager ? manager.getRepository(ChatbotFlowExecutions) : this;

    return repo.findOne({ where: { id } });
  }

  /** A resposta é registrada antes de enfileirar: um timeout não pode ultrapassá-la. */
  async registrarResposta(execucao: ChatbotFlowExecutions, texto: string, manager: EntityManager): Promise<string | null> {
    if (!execucao.waiting_for || execucao.waiting_for.reply) return null;
    const token = execucao.waiting_for.token ?? randomUUID();
    const gravou = await this.salvarComLock(execucao.id, execucao.version, {
      waiting_for: { ...execucao.waiting_for, token, reply: { text: texto, received_at: new Date().toISOString() } },
    }, manager);
    return gravou ? token : null;
  }

  /** Ajusta o início da contagem após o envio, sem ressuscitar uma espera respondida/cancelada. */
  async renovarPrazoAposEnvio(id: number, token: string, minutos: number): Promise<void> {
    await this.dataSource.query(`UPDATE chatbot_flow_executions
      SET waiting_for = jsonb_set(waiting_for, '{timeout_at}', to_jsonb($3::text)), version = version + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'suspended' AND waiting_for->>'token' = $2
      AND waiting_for->'reply' IS NULL`, [id, token, new Date(Date.now() + minutos * 60000).toISOString()]);
  }

  /** O banco recupera prazos/respostas mesmo se o Redis ou o processo reiniciar. */
  async buscarRetomadasPendentes(): Promise<Pick<ChatbotFlowExecutions, 'id' | 'waiting_for'>[]> {
    return this.dataSource.query(`SELECT id, waiting_for FROM chatbot_flow_executions
      WHERE status = 'suspended' AND waiting_for->>'type' = 'contact_reply'
      AND (waiting_for->'reply' IS NOT NULL OR waiting_for->>'timeout_at' <= $1)
      ORDER BY updated_at NULLS FIRST LIMIT 100`, [new Date().toISOString()]);
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
