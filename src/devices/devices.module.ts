import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DevicesController } from './devices.controller';
import { DevicesRepository } from './devices.repository';
import { DevicesService } from './devices.service';
import { UserDevices } from './entities/user-devices.entity';

/** Celulares do app para push (Fase 2b do app). */
@Module({
  // `autoLoadEntities`: a entidade só entra no DataSource pelo forFeature.
  imports: [TypeOrmModule.forFeature([UserDevices])],
  controllers: [DevicesController],
  providers: [DevicesService, DevicesRepository],
  exports: [DevicesService],
})
export class DevicesModule {}
