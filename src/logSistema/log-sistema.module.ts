import { Module } from '@nestjs/common';
import { LogSistemaService } from './log-sistema.service';
import { LogSistemaRepository } from './log-sistema.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogSistema } from './log-sistema.entity';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [TypeOrmModule.forFeature([LogSistema])],
  providers: [
    LogSistemaService,
    LogSistemaRepository,
  ],
  exports: [LogSistemaService], // Exporte o serviço para que outros módulos possam usá-lo
})
export class LogSistemaModule {}
