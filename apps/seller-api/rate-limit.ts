/**
 * IP-based rate limiter for the seller-api.
 * Uses Redis when REDIS_URL is set, falls back to in-memory Map.
 * Circuit breaker pattern: if Redis fails repeatedly, auto-fallback to in-memory.
 *
 * ⚠️  In production, REDIS_URL is strongly recommended for distributed rate limiting.
 *     In-memory fallback does not work across multiple instances.
 */

import { Request, Response, NextFunction } from "express";
import { createLogger } from "@apitoll/shared";

const log = createLogger("seller-api:rate-limit");

// Warn loudly at startup if Redis is missing in production
if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL && !process.env.REDIS_HOST) {
  log.error(
    "⚠️  REDIS_URL not set in production! Rate limiting will use in-memory store, " +
    "which does NOT work across multiple instances. Set REDIS_URL for distributed rate limiting."
  );
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key);
  }
}, 60_000);

function checkMemory(key: string, max: number, windowMs: number): { allowed: boolean; count: number; resetAt: number } {
  const now = Date.now();
  let entry = memoryStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    memoryStore.set(key, entry);
  }
  entry.count++;

  // Evict stale entries if map grows too large
  if (memoryStore.size > 10_000) {
    for (const [k, v] of memoryStore) {
      if (now > v.resetAt) memoryStore.delete(k);
    }
  }

  return { allowed: entry.count <= max, count: entry.count, resetAt: entry.resetAt };
}

let redis: { incr(key: string): Promise<number>; expire(key: string, seconds: number): Promise<void> } | null = null;
let circuitOpen = true;
let circuitOpenedAt = Date.now();
let redisFailureCount = 0;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 30_000;

const redisUrl = process.env.REDIS_URL
  || (process.env.REDIS_HOST
    ? `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT || "6379"}`
    : null);

if (redisUrl) {
  try {
    const Redis = require("redis");
    const client = Redis.createClient({ url: redisUrl });
    client.connect?.().then(() => {
      redis = client;
      circuitOpen = false;
      log.info("Redis connected for rate limiting");
    }).catch((err: Error) => {
      log.warn("Redis connect failed, using in-memory", { error: err.message });
    });
    client.on?.("error", (err: Error) => {
      log.error("Redis error", { error: err.message });
      redisFailureCount++;
      if (redisFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitOpen = true;
        circuitOpenedAt = Date.now();
      }
    });
  } catch {
    log.warn("Redis not available, using in-memory rate limiting");
  }
}

async function checkRedis(key: string, max: number, windowSec: number): Promise<{ allowed: boolean; count: number }> {
  if (!redis || circuitOpen) {
    // Try to reset circuit after cooldown
    if (circuitOpen && Date.now() - circuitOpenedAt > CIRCUIT_RESET_MS) {
      circuitOpen = false;
      redisFailureCount = 0;
    } else {
      throw new Error("circuit_open");
    }
  }

  try {
    const count = await redis!.incr(key);
    if (count === 1) {
      await redis!.expire(key, windowSec);
    }
    redisFailureCount = 0;
    return { allowed: count <= max, count };
  } catch (e) {
    redisFailureCount++;
    if (redisFailureCount >= CIRCUIT_FAILURE_THRESHOLD) {
      circuitOpen = true;
      circuitOpenedAt = Date.now();
      log.warn("Redis circuit breaker OPEN. Falling back to in-memory.");
    }
    throw e;
  }
}

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}) {
  const { windowMs, max, keyPrefix = "rl", message = "Too many requests" } = opts;
  const windowSec = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const redisKey = `${keyPrefix}:${ip}:${Math.floor(Date.now() / windowMs)}`;
    const memKey = `${keyPrefix}:${ip}`;

    let allowed: boolean;
    let count: number;
    let resetAt: number;

    try {
      const result = await checkRedis(redisKey, max, windowSec);
      allowed = result.allowed;
      count = result.count;
      resetAt = Math.ceil(Date.now() / 1000) + windowSec;
    } catch {
      // Fallback to in-memory
      const result = checkMemory(memKey, max, windowMs);
      allowed = result.allowed;
      count = result.count;
      resetAt = Math.ceil(result.resetAt / 1000);
    }

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - count));
    res.setHeader("X-RateLimit-Reset", resetAt);

    if (!allowed) {
      const retryAfter = Math.max(1, resetAt - Math.ceil(Date.now() / 1000));
      res.status(429).json({
        error: message,
        retryAfter,
      });
      return;
    }

    next();
  };
}
