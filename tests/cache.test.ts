/**
 * Tests for LLM Response Cache module.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  LLMCache,
  createCacheConfig,
  DEFAULT_CACHE_CONFIG,
  getGlobalCache,
  resetGlobalCache,
} from '../src/cache/index.js';

describe('LLMCache', () => {
  let cache: LLMCache;

  beforeEach(() => {
    cache = new LLMCache();
  });

  describe('constructor', () => {
    it('should create cache with default config', () => {
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(DEFAULT_CACHE_CONFIG.maxEntries);
      expect(cache.enabled).toBe(true);
    });

    it('should create cache with custom config', () => {
      const customCache = new LLMCache({
        maxEntries: 100,
        ttlMs: 5000,
      });
      const config = customCache.getConfig();
      expect(config.maxEntries).toBe(100);
      expect(config.ttlMs).toBe(5000);
    });

    it('should create disabled cache', () => {
      const disabledCache = new LLMCache({ enabled: false });
      expect(disabledCache.enabled).toBe(false);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys for same inputs', () => {
      const params = {
        systemPrompt: 'You are a helpful assistant',
        userPrompt: 'Hello world',
        maxTokens: 100,
      };
      const key1 = cache.generateKey(params);
      const key2 = cache.generateKey(params);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cache.generateKey({
        systemPrompt: 'System 1',
        userPrompt: 'User 1',
        maxTokens: 100,
      });
      const key2 = cache.generateKey({
        systemPrompt: 'System 2',
        userPrompt: 'User 2',
        maxTokens: 100,
      });
      expect(key1).not.toBe(key2);
    });

    it('should include model in key when configured', () => {
      const paramsWithModel = {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 100,
        model: 'gpt-4',
      };
      const paramsWithDifferentModel = {
        ...paramsWithModel,
        model: 'gpt-3.5',
      };
      const key1 = cache.generateKey(paramsWithModel);
      const key2 = cache.generateKey(paramsWithDifferentModel);
      expect(key1).not.toBe(key2);
    });

    it('should exclude model from key when configured', () => {
      const cacheWithoutModel = new LLMCache({ includeModelInKey: false });
      const paramsWithModel = {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 100,
        model: 'gpt-4',
      };
      const paramsWithDifferentModel = {
        ...paramsWithModel,
        model: 'gpt-3.5',
      };
      const key1 = cacheWithoutModel.generateKey(paramsWithModel);
      const key2 = cacheWithoutModel.generateKey(paramsWithDifferentModel);
      expect(key1).toBe(key2);
    });
  });

  describe('get/set', () => {
    const testParams = {
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt',
      maxTokens: 100,
    };

    it('should return null for non-existent keys', () => {
      const result = cache.get(testParams);
      expect(result).toBeNull();
    });

    it('should store and retrieve values', () => {
      cache.set(testParams, 'Test response', { tokensIn: 10, tokensOut: 20 });
      const result = cache.get(testParams);
      expect(result).not.toBeNull();
      expect(result!.text).toBe('Test response');
      expect(result!.tokensIn).toBe(10);
      expect(result!.tokensOut).toBe(20);
    });

    it('should track hit count', () => {
      cache.set(testParams, 'Response');
      const result1 = cache.get(testParams);
      expect(result1!.hitCount).toBe(1);
      const result2 = cache.get(testParams);
      expect(result2!.hitCount).toBe(2);
    });

    it('should not cache when disabled', () => {
      const disabledCache = new LLMCache({ enabled: false });
      disabledCache.set(testParams, 'Response');
      const result = disabledCache.get(testParams);
      expect(result).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortTtlCache = new LLMCache({ ttlMs: 50 });
      const params = {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 100,
      };

      shortTtlCache.set(params, 'Response');
      expect(shortTtlCache.get(params)).not.toBeNull();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      const result = shortTtlCache.get(params);
      expect(result).toBeNull();
    });
  });

  describe('size limits', () => {
    it('should evict oldest entries when at capacity', () => {
      const smallCache = new LLMCache({ maxEntries: 3 });

      // Add 3 entries
      for (let i = 0; i < 3; i++) {
        smallCache.set(
          { systemPrompt: `S${i}`, userPrompt: `U${i}`, maxTokens: 100 },
          `Response ${i}`
        );
      }

      expect(smallCache.size).toBe(3);

      // Add 4th entry - should evict oldest
      smallCache.set({ systemPrompt: 'S3', userPrompt: 'U3', maxTokens: 100 }, 'Response 3');

      expect(smallCache.size).toBe(3);
      // First entry should be evicted
      expect(smallCache.get({ systemPrompt: 'S0', userPrompt: 'U0', maxTokens: 100 })).toBeNull();
      // Last entry should exist
      expect(
        smallCache.get({ systemPrompt: 'S3', userPrompt: 'U3', maxTokens: 100 })
      ).not.toBeNull();
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const params = {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 100,
      };

      // Miss
      cache.get(params);
      let stats = cache.getStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // Set and hit
      cache.set(params, 'Response');
      cache.get(params);
      stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Hit rate
      expect(stats.hitRate).toBe(50);
    });

    it('should calculate bytes stored', () => {
      const params = {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 100,
      };

      cache.set(params, 'Short response');
      const stats = cache.getStats();
      expect(stats.bytesStored).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      const params = {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 100,
      };

      cache.get(params); // Miss
      cache.set(params, 'Response');
      cache.get(params); // Hit

      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('invalidate and clear', () => {
    it('should invalidate specific entry', () => {
      const params1 = { systemPrompt: 'S1', userPrompt: 'U1', maxTokens: 100 };
      const params2 = { systemPrompt: 'S2', userPrompt: 'U2', maxTokens: 100 };

      cache.set(params1, 'Response 1');
      cache.set(params2, 'Response 2');

      cache.invalidate(params1);

      expect(cache.get(params1)).toBeNull();
      expect(cache.get(params2)).not.toBeNull();
    });

    it('should clear all entries', () => {
      for (let i = 0; i < 5; i++) {
        cache.set({ systemPrompt: `S${i}`, userPrompt: `U${i}`, maxTokens: 100 }, `Response ${i}`);
      }

      expect(cache.size).toBe(5);
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe('has', () => {
    it('should check existence without affecting stats', () => {
      const params = {
        systemPrompt: 'System',
        userPrompt: 'User',
        maxTokens: 100,
      };

      expect(cache.has(params)).toBe(false);

      cache.set(params, 'Response');
      expect(cache.has(params)).toBe(true);

      // Stats should not be affected
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('prune', () => {
    it('should remove expired entries', async () => {
      const shortTtlCache = new LLMCache({ ttlMs: 50 });

      // Add entries
      for (let i = 0; i < 5; i++) {
        shortTtlCache.set(
          { systemPrompt: `S${i}`, userPrompt: `U${i}`, maxTokens: 100 },
          `Response ${i}`
        );
      }

      expect(shortTtlCache.size).toBe(5);

      // Wait for TTL
      await new Promise((resolve) => setTimeout(resolve, 60));

      const pruned = shortTtlCache.prune();
      expect(pruned).toBe(5);
      expect(shortTtlCache.size).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration dynamically', () => {
      cache.updateConfig({ ttlMs: 1000 });
      expect(cache.getConfig().ttlMs).toBe(1000);
    });
  });
});

describe('createCacheConfig', () => {
  it('should create config with defaults', () => {
    const config = createCacheConfig();
    expect(config).toEqual(DEFAULT_CACHE_CONFIG);
  });

  it('should override specific values', () => {
    const config = createCacheConfig({ ttlMs: 5000 });
    expect(config.ttlMs).toBe(5000);
    expect(config.maxEntries).toBe(DEFAULT_CACHE_CONFIG.maxEntries);
  });
});

describe('Global Cache', () => {
  beforeEach(() => {
    resetGlobalCache();
  });

  it('should create singleton instance', () => {
    const cache1 = getGlobalCache();
    const cache2 = getGlobalCache();
    expect(cache1).toBe(cache2);
  });

  it('should update config on existing instance', () => {
    const cache1 = getGlobalCache({ ttlMs: 1000 });
    const cache2 = getGlobalCache({ ttlMs: 5000 });
    expect(cache1).toBe(cache2);
    expect(cache2.getConfig().ttlMs).toBe(5000);
  });

  it('should reset global cache', () => {
    const cache1 = getGlobalCache();
    cache1.set({ systemPrompt: 'S', userPrompt: 'U', maxTokens: 100 }, 'Response');
    resetGlobalCache();
    const cache2 = getGlobalCache();
    expect(cache1).not.toBe(cache2);
    expect(cache2.size).toBe(0);
  });
});
