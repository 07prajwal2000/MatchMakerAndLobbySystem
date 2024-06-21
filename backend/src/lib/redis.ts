import Redis from "ioredis";

export let redis: Redis = null!;
export let redisPubSubClient: Redis = null!;

export async function initRedis() {
  redis = new Redis(6379, "localhost");
  redisPubSubClient = new Redis(6379, "localhost");
  await redis.hello();
  await redisPubSubClient.hello();
}