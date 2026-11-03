import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import { Chatbots, ChatbotType } from './entities/chatbots.entity';

@Injectable()
export class ChatbotsRepository extends Repository<Chatbots> {
  constructor(protected dataSource: DataSource) {
    super(Chatbots, dataSource.manager);
  }

  async idsComAlteracoesNaoPublicadas(ids: number[], manager?: EntityManager): Promise<number[]> {
    if (!ids.length) return [];
    const linhas = await (manager ?? this.manager).query(`SELECT c.id FROM chatbots c
      JOIN chatbot_flow_versions p ON p.id = c.current_published_version_id
      JOIN chatbot_flow_versions d ON d.chatbot_id = c.id AND d.status = 'draft'
      WHERE c.id = ANY($1::int[]) AND d.graph IS DISTINCT FROM p.graph`, [ids]);
    return linhas.map((linha: { id: number }) => Number(linha.id));
  }

  /**
   * Os chatbots ativos, exceto os fluxos complementares - a listagem
   * principal não é o lugar deles (ver `findAllComplementares`).
   */
  async findAllActive(): Promise<Chatbots[]> {
    return this.createQueryBuilder('c')
      .leftJoinAndSelect('c.channels', 'channels')
      .where('c.deleted_at IS NULL')
      .andWhere("c.type != 'complementar'")
      .orderBy('c.name', 'ASC')
      .getMany();
  }

  /** Fluxos complementares ativos - compartilhados entre todos os chatbots. */
  async findAllComplementares(): Promise<Chatbots[]> {
    return this.find({
      where: { type: 'complementar', deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findById(id: number, emitError = true): Promise<Chatbots> {
    const chatbot = await this.findOne({ where: { id, deleted_at: IsNull() } });

    if (!chatbot && emitError) {
      throw new NotFoundException('Chatbot não encontrado');
    }

    return chatbot;
  }

  /** Nome já usado por outro chatbot ativo - `lower()` nos dois lados. */
  async nomeEmUso(name: string, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('c')
      .where('lower(c.name) = lower(:name)', { name: name.trim() })
      .andWhere('c.deleted_at IS NULL');

    if (ignorarId) query.andWhere('c.id != :ignorarId', { ignorarId });

    return query.getExists();
  }

  /**
   * Já existe um chatbot ativo deste tipo neste canal?
   *
   * Sem constraint de banco (M:N não suporta um índice único direto nesse
   * formato) - decisão do usuário: valida na aplicação, chamado antes de
   * ativar/vincular cada canal, para devolver um erro legível em caso de
   * conflito.
   */
  async ativoNoCanal(channelId: number, type: ChatbotType, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('c')
      .innerJoin('channel_x_chatbot', 'cxc', 'cxc.chatbot_id = c.id')
      .where('cxc.channel_id = :channelId', { channelId })
      .andWhere('c.type = :type', { type })
      .andWhere('c.active = true')
      .andWhere('c.deleted_at IS NULL');

    if (ignorarId) query.andWhere('c.id != :ignorarId', { ignorarId });

    return query.getExists();
  }

  /** O chatbot de entrada ativo de um canal, se houver - usado pelo motor. */
  async findEntradaAtivoDoCanal(channelId: number, manager?: EntityManager): Promise<Chatbots | null> {
    return this.findAtivoDoCanal(channelId, 'entrada', manager);
  }

  async findSaidaAtivoDoCanal(channelId: number, manager?: EntityManager): Promise<Chatbots | null> {
    return this.findAtivoDoCanal(channelId, 'saida', manager);
  }

  private async findAtivoDoCanal(channelId: number, tipo: 'entrada' | 'saida', manager?: EntityManager): Promise<Chatbots | null> {
    const repo = manager ? manager.getRepository(Chatbots) : this;

    return repo
      .createQueryBuilder('c')
      .innerJoin('channel_x_chatbot', 'cxc', 'cxc.chatbot_id = c.id')
      .where('cxc.channel_id = :channelId', { channelId })
      .andWhere('c.type = :type', { type: tipo })
      .andWhere('EXISTS (SELECT 1 FROM channels canal WHERE canal.id = cxc.channel_id AND canal.chatbot_habilitado = true AND canal.deleted_at IS NULL)')
      .andWhere('c.active = true')
      .andWhere('c.deleted_at IS NULL')
      .getOne();
  }

  /** Os canais vinculados ao chatbot - usado pela validação de conflito ao salvar. */
  async findCanaisDoChatbot(chatbotId: number, manager?: EntityManager): Promise<number[]> {
    const linhas = await (manager ?? this.manager).query(
      'SELECT channel_id FROM channel_x_chatbot WHERE chatbot_id = $1',
      [chatbotId],
    );

    return linhas.map((l: { channel_id: number }) => l.channel_id);
  }
}
