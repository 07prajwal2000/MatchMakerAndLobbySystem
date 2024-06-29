import crypto from "crypto";
import { Redis } from "ioredis";

export class RedisLock {
  private redis: Redis = null!;
  private key: string = "";
  private delay: number = 3;
  private uniqueId: string = "";
  
  constructor(redis: Redis, key: string, delay: number = 3) {
    this.key = key;
    this.delay = delay;
    this.redis = redis;
    this.uniqueId = crypto.randomUUID().substring(0, 5);
  }
  
  public async lock(): Promise<boolean> {
    const lockCount = await this.redis.setnx(this.key, this.uniqueId);
    if (lockCount > 0) await this.redis.expire(this.key, this.delay);
    return lockCount > 0;
  }

  public async isLocked() {
    const uId = await this.redis.get(this.key);
    return uId && uId != this.uniqueId;
  }

  public async release() {
    await this.redis.del(this.key);
  }
}