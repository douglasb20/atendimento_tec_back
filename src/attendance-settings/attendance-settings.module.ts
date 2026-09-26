import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceSettingsController } from './attendance-settings.controller';
import { AttendanceSettingsRepository } from './attendance-settings.repository';
import { AttendanceSettingsService } from './attendance-settings.service';
import { AttendanceSettings } from './entities/attendance-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceSettings])],
  controllers: [AttendanceSettingsController],
  providers: [AttendanceSettingsService, AttendanceSettingsRepository],
  exports: [AttendanceSettingsService],
})
export class AttendanceSettingsModule {}
