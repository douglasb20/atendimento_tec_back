import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';

import { Holidays } from './entities/holidays.entity';

@Injectable()
export class HolidaysRepository extends Repository<Holidays> {
  constructor(protected dataSource: DataSource) {
    super(Holidays, dataSource.manager);
  }

  async findAllActive(): Promise<Holidays[]> {
    return this.find({
      where: { deleted_at: IsNull() },
      order: { month: 'ASC', day: 'ASC' },
    });
  }

  async findById(id: number, emitError = true): Promise<Holidays> {
    const feriado = await this.findOne({ where: { id, deleted_at: IsNull() } });

    if (!feriado && emitError) {
      throw new NotFoundException('Feriado não encontrado');
    }

    return feriado;
  }

  /**
   * Existe algum feriado em `month`/`day` - recorrente (vale todo ano) ou de
   * data completa casando com `year`. Usado pelo nó "Feriados" do chatbot.
   */
  async existeEm(month: number, day: number, year: number): Promise<boolean> {
    return this.createQueryBuilder('h')
      .where('h.deleted_at IS NULL')
      .andWhere('h.month = :month', { month })
      .andWhere('h.day = :day', { day })
      .andWhere('(h.recurring = true OR h.year = :year)', { year })
      .getExists();
  }
}
