import { Redis } from 'ioredis';

/** Small key-value surface used for rate limiting and lockouts. */
export interface Kv {
  /** Increments a counter, starting its TTL on first increment. Returns the new value. */
  incr(key: string, ttlSec: number): Promise<number>;
  /** Remaining TTL in seconds, or 0 if the key does not exist. */
  ttl(key: string): Promise<number>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  /** Reads and deletes a value in one step, so a one-time value can only be used once. */
  take(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  close(): Promise<void>;
}

/** Single-process store for development and tests. Not suitable behind a load balancer. */
export function createMemoryKv(now: () => number = Date.now): Kv {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  const live = (key: string) => {
    const entry = entries.get(key);
    if (entry && entry.expiresAt <= now()) {
      entries.delete(key);
      return undefined;
    }
    return entry;
  };
  return {
    async incr(key, ttlSec) {
      const entry = live(key);
      if (!entry) {
        entries.set(key, { value: '1', expiresAt: now() + ttlSec * 1000 });
        return 1;
      }
      entry.value = String(Number(entry.value) + 1);
      return Number(entry.value);
    },
    async ttl(key) {
      const entry = live(key);
      return entry ? Math.ceil((entry.expiresAt - now()) / 1000) : 0;
    },
    async set(key, value, ttlSec) {
      entries.set(key, { value, expiresAt: now() + ttlSec * 1000 });
    },
    async take(key) {
      const entry = live(key);
      entries.delete(key);
      return entry?.value ?? null;
    },
    async del(key) {
      entries.delete(key);
    },
    async close() {
      entries.clear();
    },
  };
}

export function createRedisKv(url: string): Kv {
  const redis = new Redis(url);
  return {
    async incr(key, ttlSec) {
      // NX keeps the original window when the counter already exists.
      const res = await redis.multi().incr(key).expire(key, ttlSec, 'NX').exec();
      return Number(res?.[0]?.[1] ?? 0);
    },
    async ttl(key) {
      return Math.max(0, await redis.ttl(key));
    },
    async set(key, value, ttlSec) {
      await redis.set(key, value, 'EX', ttlSec);
    },
    take: (key) => redis.getdel(key),
    async del(key) {
      await redis.del(key);
    },
    async close() {
      await redis.quit();
    },
  };
}
