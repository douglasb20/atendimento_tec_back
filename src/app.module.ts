import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { diskStorage } from 'multer';
import * as path from 'path';

import { DatabaseModule } from './core/database/database.module';
import { LogSistemaModule } from './core/logSistema/log-sistema.module';
import { QueryStorageService } from './core/query-storage/query-storage.service';
import { LogSistemaInterceptor } from './core/logSistema/log-sistema.interceptor';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientModule } from './clients/clients.module';
import { SupportsModule } from './supports/supports.module';
import { ServicesModule } from './service/services.module';
import { PermissionsModule } from 'permissions/permissions.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { SupportChatModule } from './support-chats/support-chats.module';
import { ChannelsModule } from './channels/channels.module';
import { ContactsModule } from './contacts/contacts.module';

const destPath = path.join(__dirname, '..', '..', '/files');
@Global()
@Module({
  imports: [
    MulterModule.register({
      dest: destPath,
      limits: { fileSize: 1048576 * 5 /* 5mb */ },
      storage: diskStorage({
        filename(_, file, callback) {
          const extension = file.mimetype.split('/')[1];
          const fileName = `fileUploaded_${Date.now()}.${extension}`;
          callback(null, fileName);
        },
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    DatabaseModule,
    ClientModule,
    SupportsModule,
    ServicesModule,
    LogSistemaModule,
    PermissionsModule,
    WhatsappModule,
    SupportChatModule,
    ChannelsModule,
    ContactsModule,
  ],
  exports: [MulterModule, QueryStorageService],
  providers: [
    QueryStorageService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LogSistemaInterceptor,
    },
  ],
})
export class AppModule {}
