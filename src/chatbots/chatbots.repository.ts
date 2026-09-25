import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import { Chatbots, ChatbotType } from './entities/chatbots.entity';

@Injectable()
export class ChatbotsRepository extends Repository<Chatbots> {
  constructor(protected dataSource: DataSource) {
    super(Chatbots, dataSource.manager);
  }

  /**
   * Os chatbots ativos, exceto os fluxos complementares - a listagem
   * principal não é o lugar deles (ver `findAllComplementares`).
   */
  async findAllActive(): Promise<Chatbots[]> {
    return this.createQueryBuilder('c')
      .leftJoinAndSelect('c.channel', 'channel')
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
   * Só um chatbot de cada tipo por canal - decisão do usuário. Chamado antes
   * de ativar/criar, para devolver um erro legível em vez de deixar a
   * constraint do banco estourar sem contexto.
   */
  async ativoNoCanal(channelId: number, type: ChatbotType, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('c')
      .where('c.channel_id = :channelId', { channelId })
      .andWhere('c.type = :type', { type })
      .andWhere('c.active = true')
      .andWhere('c.deleted_at IS NULL');

    if (ignorarId) query.andWhere('c.id != :ignorarId', { ignorarId });

    return query.getExists();
  }

  /** O chatbot de entrada ativo de um canal, se houver - usado pelo motor. */
  async findEntradaAtivoDoCanal(channelId: number, manager?: EntityManager): Promise<Chatbots | null> {
    const repo = manager ? manager.getRepository(Chatbots) : this;

    return repo.findOne({
      where: { channel_id: channelId, type: 'entrada', active: true, deleted_at: IsNull() },
    });
  }
}
