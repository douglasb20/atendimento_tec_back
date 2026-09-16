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
        db: Number(process.env.REDIS_DB_CACHE ?? 1),
        // Prefixo por ambiente: o cache guarda reservas de envio de mídia
        // (`reservaEnvioComMidia`) chaveadas por `message_id`, e ids de
        // ambientes distintos podem colidir num Redis compartilhado.
        ...(process.env.REDIS_PREFIX && { keyPrefix: process.env.REDIS_PREFIX }),
      },
    }),
  ],
  providers: [RedisCacheRepository],
  exports: [RedisCacheRepository],
})
export class RedisCacheModule {}
