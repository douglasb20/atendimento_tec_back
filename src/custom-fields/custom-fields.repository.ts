import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';

import { AplicaA, CustomFields } from './entities/custom-fields.entity';

@Injectable()
export class CustomFieldsRepository extends Repository<CustomFields> {
  constructor(dataSource: DataSource) {
    super(CustomFields, dataSource.manager);
  }

  async findAllActive(): Promise<CustomFields[]> {
    return this.find({
      where: { deleted_at: IsNull() },
      order: { nome: 'ASC' },
    });
  }

  /**
   * Os campos que servem a um lado, com os de `ambos` incluídos.
   *
   * É o que a tela pede ao montar o seletor: um "CNPJ" cadastrado só para
   * cliente não deve aparecer no formulário de contato.
   */
  async findPorAplicacao(aplicaA: Exclude<AplicaA, 'ambos'>): Promise<CustomFields[]> {
    return this.find({
      where: [
        { aplica_a: aplicaA, deleted_at: IsNull() },
        { aplica_a: 'ambos', deleted_at: IsNull() },
      ],
      order: { nome: 'ASC' },
    });
  }

  async findById(id: number, emitError = true): Promise<CustomFields | null> {
    const campo = await this.findOne({ where: { id, deleted_at: IsNull() } });

    if (!campo && emitError) {
      throw new NotFoundException('Campo personalizado não encontrado');
    }

    return campo;
  }

  /**
   * Resolve ids em entidades, para validar os valores contra o tipo declarado.
   *
   * Recebe o `manager` porque é chamado de dentro da transação que grava o
   * contato: pelo repositório, a leitura cairia fora dela.
   */
  async findByIds(ids: number[], manager?: EntityManager): Promise<CustomFields[]> {
    if (!ids?.length) return [];

    const origem = manager ?? this.manager;

    return origem.find(CustomFields, {
      where: { id: In(ids), deleted_at: IsNull() },
    });
  }

  /**
   * Quantos contatos e clientes usam este campo.
   *
   * Consultado antes de excluir e antes de trocar o tipo - as duas operações
   * que estragariam o que já foi preenchido.
   */
  async contarUsos(id: number): Promise<number> {
    const [contatos, clientes] = await Promise.all([
      this.manager.query<{ total: number }[]>(
        'SELECT COUNT(*)::int AS total FROM contact_custom_values WHERE custom_field_id = $1',
        [id],
      ),
      this.manager.query<{ total: number }[]>(
        'SELECT COUNT(*)::int AS total FROM client_custom_values WHERE custom_field_id = $1',
        [id],
      ),
    ]);

    return (contatos[0]?.total ?? 0) + (clientes[0]?.total ?? 0);
  }

  /**
   * Nome já usado por outro campo ativo.
   *
   * Espelha o índice único `lower(nome)` do banco: a checagem aqui existe para
   * a mensagem ser legível, não para substituir a garantia.
   */
  async nomeEmUso(nome: string, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('cf')
      .where('lower(cf.nome) = lower(:nome)', { nome })
      .andWhere('cf.deleted_at IS NULL');

    if (ignorarId) {
      query.andWhere('cf.id <> :ignorarId', { ignorarId });
    }

    return query.getExists();
  }
}
