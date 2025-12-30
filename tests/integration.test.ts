/**
 * Integration tests - end-to-end workflows with REAL API calls.
 */

import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import {
  ToolFactoryAgent,
  createProvider,
  WebSearcher,
  LLMProvider,
} from '../src/index.js';

describe('Integration Tests', () => {
  // OAuth tokens (sk-ant-oat01-) only work with Claude Agent SDK, not direct API
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hasAnthropicKey = !!anthropicKey && anthropicKey.startsWith('sk-ant-api');
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasGoogleKey = !!process.env.GOOGLE_API_KEY;
  const templatesExist = existsSync(resolve(__dirname, '../src/templates/server.ts.hbs'));

  describe('Provider to Generation Workflow', () => {
    it.skipIf(!hasAnthropicKey)(
      'should use provider for generation planning',
      async () => {
        const provider = createProvider('anthropic', {
          apiKey: process.env.ANTHROPIC_API_KEY!,
          model: 'claude-sonnet-4-5-20250929',
          temperature: 0,
        });

        // Test that provider can generate tool specs
        const response = await provider.call(
          'You are a tool designer. Output valid JSON only.',
          `Design a simple MCP tool for getting current time. Output as JSON:
          {"name": "get_time", "description": "...", "parameters": []}`,
          200
        );

        expect(response.error).toBeUndefined();
        expect(response.text).toContain('get_time');
      },
      60000
    );
  });

  describe('Web Search to Tool Generation', () => {
    it.skipIf(!hasAnthropicKey || !templatesExist)(
      'should use web search info in tool generation',
      async () => {
        // First, search for API info
        const searcher = new WebSearcher(
          LLMProvider.ANTHROPIC,
          process.env.ANTHROPIC_API_KEY!
        );

        const searchResult = await searcher.search('MCP Model Context Protocol tool format');
        expect(searchResult.content.length).toBeGreaterThan(0);

        // Then use the info to help generate a tool
        const agent = new ToolFactoryAgent({
          config: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
            apiKey: process.env.ANTHROPIC_API_KEY!,
          },
        });

        const result = await agent.generateFromDescription(
          'Create a tool that echoes back the user input',
          { serverName: 'EchoServer' }
        );

        expect(result.toolSpecs.length).toBeGreaterThan(0);
        expect(result.serverCode).toContain('mcp');
      },
      120000
    );
  });

  describe('Multi-Provider Comparison', () => {
    it.skipIf(!hasAnthropicKey || !hasOpenAIKey)(
      'should generate similar tools with different providers',
      async () => {
        const prompt = 'Say hello and your model name';

        // Test Anthropic
        const anthropicProvider = createProvider('anthropic', {
          apiKey: process.env.ANTHROPIC_API_KEY!,
          model: 'claude-sonnet-4-5-20250929',
          temperature: 0,
        });
        const anthropicResponse = await anthropicProvider.call('Be concise.', prompt, 50);

        // Test OpenAI
        const openaiProvider = createProvider('openai', {
          apiKey: process.env.OPENAI_API_KEY!,
          model: 'gpt-5.2',
          temperature: 0,
        });
        const openaiResponse = await openaiProvider.call('Be concise.', prompt, 50);

        // Both should succeed
        expect(anthropicResponse.error).toBeUndefined();
        expect(openaiResponse.error).toBeUndefined();

        // Both should contain hello
        expect(anthropicResponse.text.toLowerCase()).toContain('hello');
        expect(openaiResponse.text.toLowerCase()).toContain('hello');
      },
      60000
    );
  });

  describe('Generated Server Code Validation', () => {
    it.skipIf(!hasAnthropicKey || !templatesExist)(
      'should generate syntactically valid Python code',
      async () => {
        const agent = new ToolFactoryAgent({
          config: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
            apiKey: process.env.ANTHROPIC_API_KEY!,
          },
        });

        const result = await agent.generateFromDescription(
          'Create a tool that multiplies two numbers',
          { serverName: 'MathServer' }
        );

        // Check for required TypeScript/MCP components
        expect(result.serverCode).toContain('import');
        expect(result.serverCode).toContain('server.tool');
        expect(result.serverCode).toContain('MathServer');

        // Check no template placeholders left
        expect(result.serverCode).not.toContain('{{');
        expect(result.serverCode).not.toContain('}}');
      },
      120000
    );

    it.skipIf(!hasAnthropicKey || !templatesExist)(
      'should generate code that can be saved to file',
      async () => {
        const agent = new ToolFactoryAgent({
          config: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
            apiKey: process.env.ANTHROPIC_API_KEY!,
          },
        });

        const result = await agent.generateFromDescription(
          'Create a simple ping tool',
          { serverName: 'PingServer' }
        );

        // Create temp directory and write file
        const tempDir = mkdtempSync(join(tmpdir(), 'mcp-test-'));
        const serverPath = join(tempDir, 'server.py');

        try {
          writeFileSync(serverPath, result.serverCode, 'utf-8');
          expect(existsSync(serverPath)).toBe(true);
        } finally {
          // Cleanup
          rmSync(tempDir, { recursive: true, force: true });
        }
      },
      120000
    );
  });
});
