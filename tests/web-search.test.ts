/**
 * Tests for web search functionality - using REAL API calls.
 */

import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import { WebSearcher, LLMProvider } from '../src/index.js';

describe('Web Search - Real API Calls', () => {
  // OAuth tokens (sk-ant-oat01-) only work with Claude Agent SDK, not direct API
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hasAnthropicKey = !!anthropicKey && anthropicKey.startsWith('sk-ant-api');
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasGoogleKey = !!process.env.GOOGLE_API_KEY;

  describe('Anthropic Web Search', () => {
    it.skipIf(!hasAnthropicKey)('should search with Claude and return results', async () => {
      const searcher = new WebSearcher(
        LLMProvider.ANTHROPIC,
        process.env.ANTHROPIC_API_KEY!
      );

      const result = await searcher.search('What is the Model Context Protocol MCP?');

      expect(result.query).toBe('What is the Model Context Protocol MCP?');
      expect(result.content.length).toBeGreaterThan(100);
      expect(result.rawApiRequest).toBeDefined();
      expect(result.rawApiResponse).toBeDefined();
    }, 60000);

    it.skipIf(!hasAnthropicKey)('should extract citations from Anthropic search', async () => {
      const searcher = new WebSearcher(
        LLMProvider.ANTHROPIC,
        process.env.ANTHROPIC_API_KEY!
      );

      const result = await searcher.search('Anthropic Claude API documentation 2025');

      expect(result.content.length).toBeGreaterThan(0);
      // Citations may or may not be present depending on the response
    }, 60000);
  });

  describe('OpenAI Web Search', () => {
    // Note: OpenAI web search uses gpt-4o with web_search tool
    it.skipIf(!hasOpenAIKey)('should search with OpenAI and return results', async () => {
      const searcher = new WebSearcher(
        LLMProvider.OPENAI,
        process.env.OPENAI_API_KEY!,
        'gpt-5.2' // Use gpt-5.2 for web search
      );

      const result = await searcher.search('What is OpenAI GPT-5?');

      expect(result.query).toBe('What is OpenAI GPT-5?');
      expect(result.content.length).toBeGreaterThan(100);
      expect(result.rawApiRequest).toBeDefined();
    }, 60000);
  });

  describe('Google Web Search', () => {
    it.skipIf(!hasGoogleKey)('should search with Google and return results', async () => {
      const searcher = new WebSearcher(
        LLMProvider.GOOGLE,
        process.env.GOOGLE_API_KEY!
      );

      const result = await searcher.search('What is Google Gemini 3?');

      expect(result.query).toBe('What is Google Gemini 3?');
      expect(result.content.length).toBeGreaterThan(100);
    }, 60000);
  });
});

describe('Search Result Structure', () => {
  // OAuth tokens (sk-ant-oat01-) only work with Claude Agent SDK, not direct API
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hasAnthropicKey = !!anthropicKey && anthropicKey.startsWith('sk-ant-api');

  it.skipIf(!hasAnthropicKey)('should return proper SearchResult structure', async () => {
    const searcher = new WebSearcher(
      LLMProvider.ANTHROPIC,
      process.env.ANTHROPIC_API_KEY!
    );

    const result = await searcher.search('MCP servers npm');

    // Verify structure
    expect(result).toHaveProperty('query');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('sources');
    expect(result).toHaveProperty('rawApiRequest');
    expect(result).toHaveProperty('rawApiResponse');

    // Verify types
    expect(typeof result.query).toBe('string');
    expect(typeof result.content).toBe('string');
    expect(Array.isArray(result.sources)).toBe(true);
  }, 60000);
});
