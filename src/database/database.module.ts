import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async (configService: ConfigService) => {
        return {
          type: 'mysql',
          host: configService.get('DB_HOST'),
          port: Number(configService.get('DB_PORT')),
          username: configService.get('DB_USER'),
          password: configService.get('DB_PASS'),
          database: configService.get('DB_NAME'),
          // entities: [join(__dirname, '**/*entity.{ts,js}')],
          autoLoadEntities: true,
          synchronize: false,
          dateStrings: true,
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
