/**
 * LLM Response Cache Module.
 *
 * Provides caching for LLM responses to avoid redundant API calls
 * for identical or similar prompts. Cache keys are SHA-256 hashes
 * of concatenated request parameters (system prompt, user prompt,
 * max tokens, and optionally model/temperature).
 *
 * Supports:
 * - In-memory caching with configurable TTL (default: 1 hour)
 * - Content-based SHA-256 hashing for cache keys
 * - LRU eviction when max entries reached
 * - Cache statistics and monitoring
 * - Global singleton via {@link getGlobalCache}
 *
 * @packageDocumentation
 */

import { createHash } from 'crypto';

/**
 * Configuration for the LLM cache.
 */
export interface CacheConfig {
  /** Enable/disable caching (default: true) */
  enabled: boolean;
  /** Time-to-live for cache entries in milliseconds (default: 1 hour) */
  ttlMs: number;
  /** Maximum number of entries in the cache (default: 1000) */
  maxEntries: number;
  /** Whether to include model in cache key (default: true) */
  includeModelInKey: boolean;
  /** Whether to include temperature in cache key (default: true) */
  includeTemperatureInKey: boolean;
}

/**
 * Cached LLM response entry.
 */
export interface CacheEntry {
  /** The cached response text */
  text: string;
  /** Timestamp when entry was created */
  createdAt: number;
  /** Timestamp when entry expires */
  expiresAt: number;
  /** Number of times this entry was retrieved from cache */
  hitCount: number;
  /** Original token counts (for logging) */
  tokensIn?: number | null;
  tokensOut?: number | null;
  /** Model used for generation */
  model?: string | null;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Current number of entries in cache */
  size: number;
  /** Maximum entries allowed */
  maxSize: number;
  /** Hit rate percentage */
  hitRate: number;
  /** Total bytes stored (approximate) */
  bytesStored: number;
  /** Number of entries evicted due to TTL */
  evictedByTtl: number;
  /** Number of entries evicted due to size limit */
  evictedBySize: number;
}

/**
 * Parameters for generating a cache key.
 */
export interface CacheKeyParams {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  model?: string;
  temperature?: number;
}

/**
 * Default cache configuration.
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlMs: 60 * 60 * 1000, // 1 hour
  maxEntries: 1000,
  includeModelInKey: true,
  includeTemperatureInKey: true,
};

/**
 * Create a cache configuration with defaults.
 */
export function createCacheConfig(partial?: Partial<CacheConfig>): CacheConfig {
  return {
    ...DEFAULT_CACHE_CONFIG,
    ...partial,
  };
}

/**
 * LLM Response Cache implementation.
 *
 * Provides in-memory caching with TTL-based expiration and LRU eviction.
 *
 * @example
 * ```typescript
 * const cache = new LLMCache({ ttlMs: 3600000 });
 *
 * // Check cache before making LLM call
 * const cached = cache.get({ systemPrompt, userPrompt, maxTokens });
 * if (cached) {
 *   return cached;
 * }
 *
 * // Make LLM call and cache result
 * const response = await provider.call(systemPrompt, userPrompt, maxTokens);
 * cache.set({ systemPrompt, userPrompt, maxTokens }, response.text, {
 *   tokensIn: response.tokensIn,
 *   tokensOut: response.tokensOut,
 *   model: response.model,
 * });
 * ```
 */
export class LLMCache {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    evictedByTtl: number;
    evictedBySize: number;
  } = {
    hits: 0,
    misses: 0,
    evictedByTtl: 0,
    evictedBySize: 0,
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = createCacheConfig(config);
  }

  /**
   * Generate a cache key from the request parameters.
   *
   * Uses SHA-256 hash of the concatenated parameters to create a
   * deterministic, fixed-length key.
   */
  generateKey(params: CacheKeyParams): string {
    const parts: string[] = [params.systemPrompt, params.userPrompt, String(params.maxTokens)];

    if (this.config.includeModelInKey && params.model) {
      parts.push(params.model);
    }

    if (this.config.includeTemperatureInKey && params.temperature !== undefined) {
      parts.push(String(params.temperature));
    }

    const content = parts.join('|');
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get a cached response if available and not expired.
   *
   * @param params - The request parameters to look up
   * @returns The cached text or null if not found/expired
   */
  get(params: CacheKeyParams): CacheEntry | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictedByTtl++;
      return null;
    }

    // Update hit count and return
    entry.hitCount++;
    this.stats.hits++;
    return entry;
  }

  /**
   * Store a response in the cache.
   *
   * @param params - The request parameters (used as key)
   * @param text - The response text to cache
   * @param metadata - Optional metadata (tokens, model)
   */
  set(
    params: CacheKeyParams,
    text: string,
    metadata?: {
      tokensIn?: number | null;
      tokensOut?: number | null;
      model?: string | null;
    }
  ): void {
    if (!this.config.enabled) {
      return;
    }

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.config.maxEntries) {
      this.evictOldest();
    }

    const key = this.generateKey(params);
    const now = Date.now();

    const entry: CacheEntry = {
      text,
      createdAt: now,
      expiresAt: now + this.config.ttlMs,
      hitCount: 0,
      tokensIn: metadata?.tokensIn,
      tokensOut: metadata?.tokensOut,
      model: metadata?.model,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists in the cache (without counting as hit/miss).
   */
  has(params: CacheKeyParams): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const key = this.generateKey(params);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.evictedByTtl++;
      return false;
    }

    return true;
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(params: CacheKeyParams): boolean {
    const key = this.generateKey(params);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    // Calculate approximate bytes stored
    let bytesStored = 0;
    for (const entry of this.cache.values()) {
      bytesStored += entry.text.length * 2; // Approximate UTF-16 encoding
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      hitRate: Math.round(hitRate * 100) / 100,
      bytesStored,
      evictedByTtl: this.stats.evictedByTtl,
      evictedBySize: this.stats.evictedBySize,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictedByTtl: 0,
      evictedBySize: 0,
    };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update configuration dynamically.
   */
  updateConfig(updates: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Prune expired entries from the cache.
   *
   * This is called automatically on get() but can be called
   * manually for maintenance.
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        pruned++;
        this.stats.evictedByTtl++;
      }
    }

    return pruned;
  }

  /**
   * Evict the oldest entry from the cache.
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictedBySize++;
    }
  }

  /**
   * Get the number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Check if caching is enabled.
   */
  get enabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * Global cache instance (singleton pattern).
 *
 * Use this for shared caching across multiple agents.
 */
let globalCache: LLMCache | null = null;

/**
 * Get or create the global cache instance.
 *
 * On first call, creates a new {@link LLMCache} with the given config.
 * Subsequent calls return the existing instance, optionally updating its config.
 *
 * @param config - Optional partial config to apply
 * @returns The singleton LLMCache instance
 */
export function getGlobalCache(config?: Partial<CacheConfig>): LLMCache {
  if (!globalCache) {
    globalCache = new LLMCache(config);
  } else if (config) {
    globalCache.updateConfig(config);
  }
  return globalCache;
}

/**
 * Reset the global cache instance. Clears all entries and destroys the singleton,
 * so the next call to {@link getGlobalCache} will create a fresh instance.
 */
export function resetGlobalCache(): void {
  if (globalCache) {
    globalCache.clear();
    globalCache = null;
  }
}
