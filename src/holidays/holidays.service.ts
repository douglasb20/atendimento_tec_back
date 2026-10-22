import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { runInTransaction } from '@/Utils';
import { HolidaysRepository } from './holidays.repository';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holidays } from './entities/holidays.entity';

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(
    private readonly holidaysRepository: HolidaysRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Holidays[]> {
    return this.holidaysRepository.findAllActive();
  }

  /** Hoje é feriado - usado pelo nó "Feriados" do chatbot. `data` é injetável
   * só para teste; em runtime é sempre `new Date()`. */
  async ehFeriadoHoje(data = new Date()): Promise<boolean> {
    return this.holidaysRepository.existeEm(data.getMonth() + 1, data.getDate(), data.getFullYear());
  }

  async findOne(id: number): Promise<Holidays> {
    return this.holidaysRepository.findById(id);
  }

  async create(dto: CreateHolidayDto): Promise<Holidays> {
    return runInTransaction(this.dataSource, async (manager) => {
      const salvo = await manager.save(Holidays, {
        name: dto.name.trim(),
        recurring: dto.recurring,
        year: dto.recurring ? null : dto.year,
        month: dto.month,
        day: dto.day,
      });

      this.logger.log(`Feriado criado: ${salvo.name} (id ${salvo.id})`);

      return salvo;
    });
  }

  /**
   * Feriado do sistema (`is_system`, seed da migration): só o nome pode
   * mudar - data e recorrência são fixas por lei, e mexer nelas aqui
   * desalinharia do seed sem nenhum ganho real.
   */
  async update(id: number, dto: UpdateHolidayDto): Promise<Holidays> {
    const feriado = await this.holidaysRepository.findById(id);

    if (feriado.is_system) {
      const mudaData =
        dto.recurring !== undefined ||
        dto.year !== undefined ||
        dto.month !== undefined ||
        dto.day !== undefined;

      if (mudaData) {
        throw new BadRequestException('A data deste feriado é fixa e não pode ser alterada');
      }

      return runInTransaction(this.dataSource, async (manager) => {
        if (dto.name !== undefined) {
          await manager.update(Holidays, id, { name: dto.name.trim() });
        }

        this.logger.log(`Feriado do sistema atualizado (só nome): id ${id}`);

        return manager.findOne(Holidays, { where: { id } });
      });
    }

    const recurring = dto.recurring ?? feriado.recurring;

    return runInTransaction(this.dataSource, async (manager) => {
      await manager.save(Holidays, {
        ...feriado,
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        recurring,
        // Feriado recorrente não guarda ano - limpa se a troca for para
        // recorrente, grava se vier junto de uma troca para data completa.
        year: recurring ? null : (dto.year ?? feriado.year),
        ...(dto.month !== undefined && { month: dto.month }),
        ...(dto.day !== undefined && { day: dto.day }),
      });

      this.logger.log(`Feriado atualizado: id ${id}`);

      return manager.findOne(Holidays, { where: { id } });
    });
  }

  /** Feriado do sistema nunca é removido - só os cadastrados pelo usuário. */
  async remove(id: number): Promise<{ status: string }> {
    const feriado = await this.holidaysRepository.findById(id);

    if (feriado.is_system) {
      throw new BadRequestException('Feriados nacionais não podem ser removidos');
    }

    await this.holidaysRepository.update(id, { deleted_at: new Date() });

    this.logger.log(`Feriado removido: ${feriado.name} (id ${id})`);

    return { status: 'holiday removed' };
  }
}
