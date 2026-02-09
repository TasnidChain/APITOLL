/**
 * In-memory TTL cache for API responses.
 * Each tool gets its own cache instance with appropriate TTL.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.store.clear();
  }
}

// Shared caches — one per tool/category with appropriate capacity
export const searchCache = new TTLCache(500);
export const cryptoCache = new TTLCache(200);
export const newsCache = new TTLCache(100);
export const geocodeCache = new TTLCache(1000);
export const reputationCache = new TTLCache(200);
export const scraperCache = new TTLCache(200);

// Data & Lookup
export const weatherCache = new TTLCache(500);
export const ipCache = new TTLCache(500);
export const timezoneCache = new TTLCache(200);
export const currencyCache = new TTLCache(200);
export const countryCache = new TTLCache(300);
export const companyCache = new TTLCache(200);
export const whoisCache = new TTLCache(200);
export const dnsCache = new TTLCache(500);
export const domainCache = new TTLCache(200);
export const holidayCache = new TTLCache(200);

// Text Processing (POST endpoints — smaller caches)
export const textCache = new TTLCache(500);

// Web & URL Utilities
export const webCache = new TTLCache(500);

// Compute & Dev Tools
export const computeCache = new TTLCache(300);

// Media & Visual
export const mediaCache = new TTLCache(300);

// Blockchain
export const blockchainCache = new TTLCache(200);

// Tier 2 APIs
export const enrichCache = new TTLCache(500);
export const pdfCache = new TTLCache(100);
export const financeCache = new TTLCache(500);
