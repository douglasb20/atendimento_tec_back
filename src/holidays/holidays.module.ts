import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HolidaysController } from './holidays.controller';
import { HolidaysRepository } from './holidays.repository';
import { HolidaysService } from './holidays.service';
import { Holidays } from './entities/holidays.entity';

/**
 * Cadastro global de feriados - pré-requisito do nó "Feriados" do chatbot
 * (ver `chatbot-engine`), que ainda não foi implementado.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Holidays])],
  controllers: [HolidaysController],
  providers: [HolidaysService, HolidaysRepository],
  exports: [HolidaysService, HolidaysRepository],
})
export class HolidaysModule {}
