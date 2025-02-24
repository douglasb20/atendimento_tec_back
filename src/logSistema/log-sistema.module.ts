import { Module } from '@nestjs/common';
import { LogSistemaService } from './log-sistema.service';
import { LogSistemaRepository } from './log-sistema.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogSistemaEntity } from './log-sistema.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LogSistemaEntity])],
  providers: [LogSistemaService, LogSistemaRepository],
  exports: [LogSistemaService], // Exporte o serviço para que outros módulos possam usá-lo
})
export class LogSistemaModule {}
