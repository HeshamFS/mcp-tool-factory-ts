/**
 * Tests for UnifiedLLMProvider.
 */

import { describe, it, expect, vi } from 'vitest';
import { LLMProvider } from '../src/config/providers.js';
import { UnifiedLLMProvider } from '../src/providers/llm-provider.js';
import { createProvider, isProviderAvailable } from '../src/providers/factory.js';
import { BaseCachingProvider, type LLMResponse } from '../src/providers/base.js';

describe('UnifiedLLMProvider', () => {
  it('should report streaming support', () => {
    const provider = new UnifiedLLMProvider(LLMProvider.ANTHROPIC, {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-5-20250929',
    });

    expect(provider.supportsStreaming).toBe(true);
  });

  it('should report correct provider name', () => {
    const provider = new UnifiedLLMProvider(LLMProvider.OPENAI, {
      apiKey: 'test-key',
      model: 'gpt-5.2',
    });

    expect(provider.providerName).toBe('openai');
  });

  it('should throw helpful error for unsupported provider', async () => {
    const provider = new UnifiedLLMProvider('unknown_provider' as LLMProvider, {
      apiKey: 'test-key',
      model: 'some-model',
    });

    await expect(
      provider.call('system', 'user', 100)
    ).resolves.toMatchObject({
      error: expect.stringContaining('Unsupported AI SDK provider'),
    });
  });
});

describe('createProvider factory', () => {
  it('should create UnifiedLLMProvider for anthropic', () => {
    const provider = createProvider(LLMProvider.ANTHROPIC, {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-5-20250929',
    });

    expect(provider).toBeInstanceOf(UnifiedLLMProvider);
    expect(provider.providerName).toBe('anthropic');
  });

  it('should create UnifiedLLMProvider for openai', () => {
    const provider = createProvider(LLMProvider.OPENAI, {
      apiKey: 'test-key',
      model: 'gpt-5.2',
    });

    expect(provider).toBeInstanceOf(UnifiedLLMProvider);
    expect(provider.providerName).toBe('openai');
  });

  it('should create UnifiedLLMProvider for google', () => {
    const provider = createProvider(LLMProvider.GOOGLE, {
      apiKey: 'test-key',
      model: 'gemini-3-flash-preview',
    });

    expect(provider).toBeInstanceOf(UnifiedLLMProvider);
    expect(provider.providerName).toBe('google');
  });

  it('should create UnifiedLLMProvider for new providers', () => {
    const newProviders = [
      LLMProvider.MISTRAL,
      LLMProvider.DEEPSEEK,
      LLMProvider.GROQ,
      LLMProvider.XAI,
      LLMProvider.AZURE,
      LLMProvider.COHERE,
    ];

    for (const p of newProviders) {
      const provider = createProvider(p, {
        apiKey: 'test-key',
        model: 'some-model',
      });

      expect(provider).toBeInstanceOf(UnifiedLLMProvider);
      expect(provider.providerName).toBe(p);
    }
  });

  it('should throw for unsupported provider string', () => {
    expect(() =>
      createProvider('nonexistent' as LLMProvider, {
        apiKey: 'test-key',
        model: 'model',
      })
    ).toThrow('Unsupported provider: nonexistent');
  });

  it('should create ClaudeCodeProvider for claude_code', () => {
    const provider = createProvider(LLMProvider.CLAUDE_CODE, {
      apiKey: 'test-key',
      model: 'claude-sonnet-4-5-20250929',
    });

    expect(provider.providerName).toBe('ClaudeCode');
  });
});

describe('BaseCachingProvider caching', () => {
  class TestProvider extends BaseCachingProvider {
    callCount = 0;

    protected async doCall(): Promise<LLMResponse> {
      this.callCount++;
      return {
        text: 'hello',
        tokensIn: 10,
        tokensOut: 20,
        latencyMs: 0,
        model: 'test',
      };
    }
  }

  it('should cache responses', async () => {
    const provider = new TestProvider({ apiKey: 'k', model: 'm' });

    const r1 = await provider.call('sys', 'user', 100);
    expect(r1.text).toBe('hello');
    expect(r1.fromCache).toBe(false);
    expect(provider.callCount).toBe(1);

    const r2 = await provider.call('sys', 'user', 100);
    expect(r2.text).toBe('hello');
    expect(r2.fromCache).toBe(true);
    expect(provider.callCount).toBe(1); // no additional call
  });

  it('should skip cache when requested', async () => {
    const provider = new TestProvider({ apiKey: 'k', model: 'm' });

    await provider.call('sys', 'user', 100);
    expect(provider.callCount).toBe(1);

    await provider.call('sys', 'user', 100, { skipCache: true });
    expect(provider.callCount).toBe(2);
  });

  it('should support disabling cache', async () => {
    const provider = new TestProvider({ apiKey: 'k', model: 'm', cache: false });

    await provider.call('sys', 'user', 100);
    await provider.call('sys', 'user', 100);
    expect(provider.callCount).toBe(2);
    expect(provider.getCacheStats()).toBeNull();
  });
});

describe('LLMProvider enum', () => {
  it('should have all expected providers', () => {
    expect(LLMProvider.ANTHROPIC).toBe('anthropic');
    expect(LLMProvider.CLAUDE_CODE).toBe('claude_code');
    expect(LLMProvider.OPENAI).toBe('openai');
    expect(LLMProvider.GOOGLE).toBe('google');
    expect(LLMProvider.MISTRAL).toBe('mistral');
    expect(LLMProvider.DEEPSEEK).toBe('deepseek');
    expect(LLMProvider.GROQ).toBe('groq');
    expect(LLMProvider.XAI).toBe('xai');
    expect(LLMProvider.AZURE).toBe('azure');
    expect(LLMProvider.COHERE).toBe('cohere');
  });

  it('should have 10 providers total', () => {
    expect(Object.keys(LLMProvider).length).toBe(10);
  });
});

describe('isProviderAvailable', () => {
  it('should return true for installed AI SDK providers', async () => {
    // These are installed as optionalDependencies
    expect(await isProviderAvailable(LLMProvider.ANTHROPIC)).toBe(true);
    expect(await isProviderAvailable(LLMProvider.OPENAI)).toBe(true);
    expect(await isProviderAvailable(LLMProvider.GOOGLE)).toBe(true);
  });
});
