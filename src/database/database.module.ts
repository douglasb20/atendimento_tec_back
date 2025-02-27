import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryStorageService } from 'query-storage/query-storage.service';
import { CustomSqlLogger } from 'Utils/CustomSqlLogger';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async (configService: ConfigService, queryStorage: QueryStorageService) => {
        return {
          type: 'mysql',
          host: configService.get('DB_HOST'),
          port: Number(configService.get('DB_PORT')),
          username: configService.get('DB_USER'),
          password: configService.get('DB_PASS'),
          database: configService.get('DB_NAME'),
          autoLoadEntities: true,
          synchronize: false,
          dateStrings: true,
          timezone: '-03:00',
          logging: ['query'],
          logger: new CustomSqlLogger(queryStorage),
        };
      },
      inject: [ConfigService, QueryStorageService],
    }),
  ],
})
export class DatabaseModule {}
