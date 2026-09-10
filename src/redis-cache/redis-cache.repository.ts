import { Injectable } from "@nestjs/common";
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';
import ms from "ms";



@Injectable()
export class RedisCacheRepository {
    private readonly redis: Redis;
  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async set(key: string, value: string, ttl: number = ms('1h')): Promise<void> {
    await this.redis.set(key, value, 'EX', ttl);
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}