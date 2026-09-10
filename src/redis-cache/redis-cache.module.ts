import { Module } from '@nestjs/common';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { RedisCacheRepository } from './redis-cache.repository';

@Module({
  imports: [
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
        password: process.env.REDIS_PASSWORD,
        username: process.env.REDIS_USERNAME,
        db: 1,
      },
    }),
  ],
  providers: [RedisCacheRepository],
  exports: [RedisCacheRepository],
})
export class RedisCacheModule {}
