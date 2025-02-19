import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Services } from './entities/service.entity';
import { ServiceRepository } from './services.repository';
import { LogSistemaModule } from 'logSistema/log-sistema.module';

@Module({
  imports: [TypeOrmModule.forFeature([Services]), LogSistemaModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServiceRepository],
})
export class ServicesModule {}
