import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttendanceSettingsModule } from '@/attendance-settings/attendance-settings.module';
import { WhatsappModule } from '@/whatsapp/whatsapp.module';
import { NotificationRecipients } from '@/notifications/entities/notification-recipients.entity';
import { Notifications } from '@/notifications/entities/notifications.entity';
import { SchedulesController } from './schedules.controller';
import { Schedules } from './entities/schedules.entity';
import { SchedulesRepository } from './schedules.repository';
import { SchedulesService } from './schedules.service';
import { ScheduleRemindersService } from './schedule-reminders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Schedules, Notifications, NotificationRecipients]), AttendanceSettingsModule, WhatsappModule],
  controllers: [SchedulesController],
  providers: [SchedulesService, SchedulesRepository, ScheduleRemindersService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
