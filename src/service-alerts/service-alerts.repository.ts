import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';

import { ServiceAlerts } from './entities/service-alerts.entity';

@Injectable()
export class ServiceAlertsRepository extends Repository<ServiceAlerts> {
  constructor(protected dataSource: DataSource) {
    super(ServiceAlerts, dataSource.manager);
  }

  /** Todos os não excluídos, para a tela de gerenciamento. */
  async findAllActive(): Promise<ServiceAlerts[]> {
    return this.find({
      where: { deleted_at: IsNull() },
      relations: ['channels'],
      order: { ativo: 'DESC', created_at: 'DESC' },
    });
  }

  async findById(id: number, emitError = true): Promise<ServiceAlerts> {
    const alerta = await this.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['channels'],
    });

    if (!alerta && emitError) {
      throw new NotFoundException(`Aviso ${id} não encontrado`);
    }

    return alerta;
  }

  /**
   * Os avisos que devem sair para um canal, agora.
   *
   * Três filtros, e os três importam:
   * - `ativo`, o liga/desliga manual;
   * - `expira_em` nulo **ou** no futuro - o prazo opcional;
   * - o canal está na lista **ou** o aviso não tem canal nenhum, que é a
   *   convenção de "vale para todos".
   *
   * QueryBuilder e não `find`: a condição do canal é um OR entre uma junção e a
   * ausência de linhas nela, que o `where` declarativo não expressa.
   *
   * ⚠️ Roda em **toda abertura de conversa**. Por isso é uma consulta só, com
   * índice em `ativo`, e não uma leitura por aviso.
   */
  async findAtivosParaCanal(channelId: number): Promise<ServiceAlerts[]> {
    return this.createQueryBuilder('a')
      .where('a.deleted_at IS NULL')
      .andWhere('a.ativo = true')
      .andWhere('(a.expira_em IS NULL OR a.expira_em > now())')
      .andWhere(
        `(
          EXISTS (SELECT 1 FROM service_alert_x_channel x
                   WHERE x.service_alert_id = a.id AND x.channel_id = :channelId)
          OR NOT EXISTS (SELECT 1 FROM service_alert_x_channel x
                          WHERE x.service_alert_id = a.id)
        )`,
        { channelId },
      )
      // Ordem de criação: com vários avisos, o cliente lê na ordem em que os
      // problemas foram registrados.
      .orderBy('a.created_at', 'ASC')
      .getMany();
  }
}
