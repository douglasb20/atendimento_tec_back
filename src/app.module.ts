import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';

import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { ClientModule } from './client/clients.module';
import { AtendimentosModule } from './atendimentos/atendimentos.module';
import { ServicesModule } from './service/services.module';
import { QueryStorageService } from './query-storage/query-storage.service';
import { LogSistemaModule } from './logSistema/log-sistema.module';
import { LogSistemaInterceptor } from './logSistema/log-sistema.interceptor';

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
    AuthModule,
    UsersModule,
    DatabaseModule,
    ClientModule,
    AtendimentosModule,
    ServicesModule,
    LogSistemaModule,
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
export class AppModule { }
