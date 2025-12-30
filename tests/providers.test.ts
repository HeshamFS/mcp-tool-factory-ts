/**
 * Tests for LLM providers - using REAL API calls.
 */

import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import {
  createProvider,
  LLMProvider,
  CLAUDE_MODELS,
  OPENAI_MODELS,
  GOOGLE_MODELS,
  DEFAULT_MODELS,
} from '../src/index.js';

describe('Provider Configuration', () => {
  describe('Model Lists', () => {
    it('should have Claude 4.5+ models only', () => {
      const modelIds = Object.keys(CLAUDE_MODELS);
      expect(modelIds.length).toBeGreaterThan(0);
      modelIds.forEach((id) => {
        expect(id).toMatch(/claude.*4.*5|claude-4/);
      });
    });

    it('should have OpenAI GPT-5+ models only', () => {
      const modelIds = Object.keys(OPENAI_MODELS);
      expect(modelIds.length).toBeGreaterThan(0);
      modelIds.forEach((id) => {
        expect(id).toMatch(/gpt-5/);
      });
    });

    it('should have Google Gemini 2.5+ models only', () => {
      const modelIds = Object.keys(GOOGLE_MODELS);
      expect(modelIds.length).toBeGreaterThan(0);
      modelIds.forEach((id) => {
        expect(id).toMatch(/gemini-(2\.5|3)/);
      });
    });

    it('should have correct default models', () => {
      expect(DEFAULT_MODELS[LLMProvider.ANTHROPIC]).toMatch(/claude.*4.*5/);
      expect(DEFAULT_MODELS[LLMProvider.OPENAI]).toBe('gpt-5.2');
      expect(DEFAULT_MODELS[LLMProvider.GOOGLE]).toBe('gemini-3-flash-preview');
    });
  });

  describe('Provider Factory', () => {
    it('should create Anthropic provider', () => {
      const provider = createProvider('anthropic', {
        apiKey: 'test-key',
        model: 'claude-sonnet-4-5-20250929',
      });
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('Anthropic');
    });

    it('should create OpenAI provider', () => {
      const provider = createProvider('openai', {
        apiKey: 'test-key',
        model: 'gpt-5.2',
      });
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('OpenAI');
    });

    it('should create Google provider', () => {
      const provider = createProvider('google', {
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
      });
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('Google');
    });

    it('should create Claude Code provider', () => {
      const provider = createProvider('claude_code', {
        apiKey: '',
        model: 'claude-sonnet-4-5-20250929',
      });
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe('ClaudeCode');
    });

    it('should throw on invalid provider', () => {
      expect(() =>
        createProvider('invalid' as any, {
          apiKey: 'test',
          model: 'test',
        })
      ).toThrow();
    });
  });
});

describe('Real API Calls', () => {
  // OAuth tokens (sk-ant-oat01-) only work with Claude Agent SDK, not direct API
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hasAnthropicKey = !!anthropicKey && anthropicKey.startsWith('sk-ant-api');
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasGoogleKey = !!process.env.GOOGLE_API_KEY;

  describe('Anthropic Provider', () => {
    it.skipIf(!hasAnthropicKey)('should call Claude API successfully', async () => {
      const provider = createProvider('anthropic', {
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0,
      });

      const response = await provider.call(
        'You are a helpful assistant.',
        'Say "Hello from Claude" and nothing else.',
        50
      );

      expect(response.text).toContain('Hello');
      expect(response.error).toBeUndefined();
      expect(response.latencyMs).toBeGreaterThan(0);
    }, 60000);
  });

  describe('OpenAI Provider', () => {
    it.skipIf(!hasOpenAIKey)('should call GPT-5.2 API successfully', async () => {
      const provider = createProvider('openai', {
        apiKey: process.env.OPENAI_API_KEY!,
        model: 'gpt-5.2',
        temperature: 0,
      });

      const response = await provider.call(
        'You are a helpful assistant.',
        'Say "Hello from GPT" and nothing else.',
        50
      );

      expect(response.text).toContain('Hello');
      expect(response.error).toBeUndefined();
      expect(response.latencyMs).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Google Provider', () => {
    it.skipIf(!hasGoogleKey)('should call Gemini 3 Flash API successfully', async () => {
      const provider = createProvider('google', {
        apiKey: process.env.GOOGLE_API_KEY!,
        model: 'gemini-3-flash-preview',
        temperature: 0,
      });

      const response = await provider.call(
        'You are a helpful assistant.',
        'Say "Hello from Gemini" and nothing else.',
        50
      );

      expect(response.text).toContain('Hello');
      expect(response.error).toBeUndefined();
      expect(response.latencyMs).toBeGreaterThan(0);
    }, 60000);
  });
});
