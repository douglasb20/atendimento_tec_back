import { randomUUID } from 'crypto';
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

  /**
   * Lock mútuo de curta duração (`SET NX PX`) - quem chega primeiro grava um
   * token próprio e segue; quem chega depois recebe `null` e sabe que outra
   * execução está com a chave. `unlock` só apaga se o token ainda for o
   * mesmo (compare-and-delete via Lua), para nunca derrubar o lock de outra
   * tentativa que já tomou posse depois do TTL expirar.
   */
  async lock(key: string, ttlMs: number): Promise<string | null> {
    const token = randomUUID();
    const ok = await this.redis.set(key, token, 'PX', ttlMs, 'NX');
    return ok ? token : null;
  }

  async unlock(key: string, token: string): Promise<void> {
    await this.redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      1,
      key,
      token,
    );
  }
}