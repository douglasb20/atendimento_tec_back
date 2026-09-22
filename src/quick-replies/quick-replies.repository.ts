import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';

import { QuickReplies } from './entities/quick-replies.entity';

@Injectable()
export class QuickRepliesRepository extends Repository<QuickReplies> {
  constructor(protected dataSource: DataSource) {
    super(QuickReplies, dataSource.manager);
  }

  async findAllActive(): Promise<QuickReplies[]> {
    return this.find({
      where: { deleted_at: IsNull() },
      order: { atalho: 'ASC' },
    });
  }

  async findById(id: number, emitError = true): Promise<QuickReplies> {
    const resposta = await this.findOne({ where: { id, deleted_at: IsNull() } });

    if (!resposta && emitError) {
      throw new NotFoundException('Resposta rápida não encontrada');
    }

    return resposta;
  }

  /**
   * Atalho já usado por outra resposta ativa.
   *
   * `lower()` nos dois lados, igual ao índice único do banco: `/Bemvindo` e
   * `/bemvindo` são o mesmo atalho para quem digita, e comparar com
   * sensibilidade a maiúsculas deixaria o duplicado passar pela validação e
   * estourar no INSERT.
   */
  async atalhoEmUso(atalho: string, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('qr')
      .where('lower(qr.atalho) = lower(:atalho)', { atalho: atalho.trim() })
      .andWhere('qr.deleted_at IS NULL');

    if (ignorarId) {
      query.andWhere('qr.id != :ignorarId', { ignorarId });
    }

    return query.getExists();
  }
}
