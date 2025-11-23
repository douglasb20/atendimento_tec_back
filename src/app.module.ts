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
import { SupportChatsModule } from './support-chats/support-chats.module';
import { ChannelsModule } from './channels/channels.module';
import { ContactsModule } from './contacts/contacts.module';
import { StorageModule } from './storage/storage.module';
import { BullModule } from '@nestjs/bullmq';

const destPath = path.resolve(__dirname, '..', '..', 'files', 'tmp');
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.BULL_REDIS_HOST,
        port: parseInt(process.env.BULL_REDIS_PORT, 10),
        password: process.env.BULL_REDIS_PASSWORD,
        username: process.env.BULL_REDIS_USERNAME,
      },
      defaultJobOptions: {
        removeOnComplete: 2,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
    MulterModule.register({
      // dest: destPath,
      limits: { fileSize: 1048576 * 100 /* 100mb */ },
      storage: diskStorage({
        destination: destPath, // Define onde salvar
        filename(_, file, callback) {
          const extension = path.extname(file.originalname);
          const guessedExt = extension || `.${file.mimetype?.split('/')[1] || 'bin'}`;
          const fileName = `upload_${Date.now()}${guessedExt}`;
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
    SupportChatsModule,
    ChannelsModule,
    ContactsModule,
    StorageModule,
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
