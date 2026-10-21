import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationRecipients } from './entities/notification-recipients.entity';
import { Notifications } from './entities/notifications.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
@Module({ imports: [TypeOrmModule.forFeature([Notifications, NotificationRecipients])], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}
