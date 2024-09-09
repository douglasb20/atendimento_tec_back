import { Global, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { MulterModule } from '@nestjs/platform-express';
import * as path from 'path';
import { diskStorage } from 'multer';
import { ClientModule } from './client/client.module';

const destPath = path.join(__dirname, '..', '..', '/files');
@Global()
@Module({
  imports: [
    MulterModule.register({
      dest: destPath,
      limits: { fileSize: 1048576 * 5 /* 5mb */ },
      storage: diskStorage({
        // destination: destPath,
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
  ],
  exports: [MulterModule],
})
export class AppModule {}
