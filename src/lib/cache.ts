import { Redis } from '@upstash/redis';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { config } from './env';

/**
 * Tiny key-value cache. Upstash Redis in production; in local dev without
 * Redis credentials it falls back to memory + JSON files in `.cache/`, so the
 * API quota survives dev-server restarts.
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  incr(key: string, ttlSeconds: number, by?: number): Promise<number>;
  del(key: string): Promise<void>;
}

const PREFIX = 'aiscout:v2:';

class RedisKV implements KV {
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    return (await this.redis.get<T>(PREFIX + key)) ?? null;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(PREFIX + key, value, { ex: ttlSeconds });
    else await this.redis.set(PREFIX + key, value);
  }
  async incr(key: string, ttlSeconds: number, by = 1) {
    const k = PREFIX + key;
    const n = await this.redis.incrby(k, by);
    if (n === by) await this.redis.expire(k, ttlSeconds);
    return n;
  }
  async del(key: string) {
    await this.redis.del(PREFIX + key);
  }
}

type Entry = { value: unknown; expiresAt: number | null };

class LocalKV implements KV {
  private mem = new Map<string, Entry>();
  private dir = path.join(process.cwd(), '.cache');

  private file(key: string) {
    return path.join(this.dir, createHash('sha1').update(key).digest('hex') + '.json');
  }
  private fresh(e: Entry | undefined | null): e is Entry {
    return !!e && (e.expiresAt === null || e.expiresAt > Date.now());
  }
  async get<T>(key: string) {
    const hit = this.mem.get(key);
    if (this.fresh(hit)) return hit.value as T;
    try {
      const e = JSON.parse(await readFile(this.file(key), 'utf8')) as Entry;
      if (this.fresh(e)) {
        this.mem.set(key, e);
        return e.value as T;
      }
    } catch {
      /* miss */
    }
    return null;
  }
  async set<T>(key: string, value: T, ttlSeconds?: number) {
    const e: Entry = { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null };
    this.mem.set(key, e);
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(this.file(key), JSON.stringify(e));
    } catch {
      /* read-only FS (e.g. serverless without Redis): memory only */
    }
  }
  async incr(key: string, ttlSeconds: number, by = 1) {
    const current = (await this.get<number>(key)) ?? 0;
    const hit = this.mem.get(key);
    const ttlLeft = this.fresh(hit) && hit.expiresAt ? Math.ceil((hit.expiresAt - Date.now()) / 1000) : ttlSeconds;
    await this.set(key, current + by, ttlLeft);
    return current + by;
  }
  async del(key: string) {
    this.mem.delete(key);
  }
}

let instance: KV | null = null;

export function kv(): KV {
  if (instance) return instance;
  const { redisUrl, redisToken } = config;
  instance = redisUrl && redisToken ? new RedisKV(new Redis({ url: redisUrl, token: redisToken })) : new LocalKV();
  return instance;
}

export const usingRedis = () => !!(config.redisUrl && config.redisToken);

/** Read-through cache helper. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const store = kv();
  const hit = await store.get<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  if (value !== null && value !== undefined) await store.set(key, value, ttlSeconds);
  return value;
}
