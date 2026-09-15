import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { Tags } from './entities/tags.entity';

@Injectable()
export class TagsRepository extends Repository<Tags> {
  constructor(protected dataSource: DataSource) {
    super(Tags, dataSource.manager);
  }

  async findAllActive(): Promise<Tags[]> {
    return this.find({
      where: { deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  }

  async findById(id: number, emitError = true): Promise<Tags> {
    const tag = await this.findOne({ where: { id, deleted_at: IsNull() } });

    if (!tag && emitError) {
      throw new NotFoundException('Etiqueta não encontrada');
    }

    return tag;
  }

  /**
   * Resolve ids em entidades, ignorando os que não existem mais.
   *
   * Usado ao gravar as etiquetas de um cliente: a tela pode enviar um id que
   * foi removido entre o carregamento e o salvamento, e derrubar a gravação
   * inteira por isso seria pior que ignorar o id órfão.
   */
  async findByIds(ids: number[], manager?: EntityManager): Promise<Tags[]> {
    if (!ids?.length) return [];

    const repo = manager ? manager.getRepository(Tags) : this;

    return repo.find({ where: { id: In(ids), deleted_at: IsNull() } });
  }

  /**
   * Quantos clientes usam a etiqueta.
   *
   * Consulta a tabela de junção diretamente: carregar a relação só para contar
   * traria as linhas de `clients` sem necessidade.
   */
  async contarClientesVinculados(tagId: number): Promise<number> {
    const [{ total }] = await this.query(
      'SELECT COUNT(*)::int AS total FROM client_x_tag WHERE tag_id = $1',
      [tagId],
    );

    return total;
  }

  /**
   * Nome já usado por outra etiqueta ativa.
   *
   * A comparação é `lower()` nos dois lados, igual ao índice único do banco —
   * checar com sensibilidade a maiúsculas deixaria "Premium" passar pela
   * validação e estourar no INSERT.
   */
  async nomeEmUso(name: string, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('t')
      .where('lower(t.name) = lower(:name)', { name: name.trim() })
      .andWhere('t.deleted_at IS NULL');

    if (ignorarId) {
      query.andWhere('t.id != :ignorarId', { ignorarId });
    }

    return query.getExists();
  }
}
