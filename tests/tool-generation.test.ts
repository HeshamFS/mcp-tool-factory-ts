/**
 * Tests for tool generation - using REAL API calls.
 */

import { describe, it, expect } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load environment variables
config({ path: resolve(__dirname, '../.env') });

import { ToolFactoryAgent, LLMProvider } from '../src/index.js';

describe('Tool Generation - Real API Calls', () => {
  // OAuth tokens (sk-ant-oat01-) only work with Claude Agent SDK, not direct API
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hasAnthropicKey = !!anthropicKey && anthropicKey.startsWith('sk-ant-api');
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const hasGoogleKey = !!process.env.GOOGLE_API_KEY;
  const templatesExist = existsSync(resolve(__dirname, '../src/templates/server.ts.hbs'));

  describe('ToolFactoryAgent Configuration', () => {
    it('should create agent with Anthropic config', () => {
      const agent = new ToolFactoryAgent({
        config: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5-20250929',
          apiKey: 'test-key',
        },
      });
      expect(agent).toBeDefined();
    });

    it('should create agent with OpenAI config', () => {
      const agent = new ToolFactoryAgent({
        config: {
          provider: 'openai',
          model: 'gpt-5.2',
          apiKey: 'test-key',
        },
      });
      expect(agent).toBeDefined();
    });

    it('should create agent with Google config', () => {
      const agent = new ToolFactoryAgent({
        config: {
          provider: 'google',
          model: 'gemini-3-flash-preview',
          apiKey: 'test-key',
        },
      });
      expect(agent).toBeDefined();
    });

    it('should require valid API key by default', () => {
      expect(() => {
        new ToolFactoryAgent({
          config: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
            apiKey: '', // Empty API key should fail validation
          },
        });
      }).toThrow();
    });

    it('should allow no LLM with requireLlm: false', () => {
      const agent = new ToolFactoryAgent({
        config: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5-20250929',
        } as any,
        requireLlm: false,
      });
      expect(agent).toBeDefined();
    });
  });

  describe('Generate Tools from Description', () => {
    it.skipIf(!hasAnthropicKey || !templatesExist)(
      'should generate tool with Anthropic',
      async () => {
        const agent = new ToolFactoryAgent({
          config: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
            apiKey: process.env.ANTHROPIC_API_KEY!,
          },
        });

        const result = await agent.generateFromDescription(
          'Create a simple calculator tool that adds two numbers',
          { serverName: 'CalculatorServer' }
        );

        expect(result.toolSpecs.length).toBeGreaterThan(0);
        expect(result.serverCode).toContain('CalculatorServer');
        expect(result.serverCode).toContain('server.tool');
      },
      120000
    );

    it.skipIf(!hasOpenAIKey || !templatesExist)(
      'should generate tool with OpenAI',
      async () => {
        const agent = new ToolFactoryAgent({
          config: {
            provider: 'openai',
            model: 'gpt-5.2',
            apiKey: process.env.OPENAI_API_KEY!,
          },
        });

        const result = await agent.generateFromDescription(
          'Create a hello world tool that greets the user',
          { serverName: 'GreeterServer' }
        );

        expect(result.toolSpecs.length).toBeGreaterThan(0);
        expect(result.serverCode).toContain('GreeterServer');
      },
      120000
    );

    it.skipIf(!hasGoogleKey || !templatesExist)(
      'should generate tool with Google',
      async () => {
        const agent = new ToolFactoryAgent({
          config: {
            provider: 'google',
            model: 'gemini-3-flash-preview',
            apiKey: process.env.GOOGLE_API_KEY!,
          },
        });

        const result = await agent.generateFromDescription(
          'Create a tool that returns the current date',
          { serverName: 'DateServer' }
        );

        expect(result.toolSpecs.length).toBeGreaterThan(0);
        expect(result.serverCode).toContain('DateServer');
      },
      120000
    );
  });

  describe('Tool Spec Validation', () => {
    it.skipIf(!hasAnthropicKey || !templatesExist)(
      'should generate valid tool specs',
      async () => {
        const agent = new ToolFactoryAgent({
          config: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-5-20250929',
            apiKey: process.env.ANTHROPIC_API_KEY!,
          },
        });

        const result = await agent.generateFromDescription(
          'Create a tool that converts Celsius to Fahrenheit with temperature as input',
          { serverName: 'TempServer' }
        );

        expect(result.toolSpecs.length).toBeGreaterThan(0);

        const toolSpec = result.toolSpecs[0];
        expect(toolSpec).toHaveProperty('name');
        expect(toolSpec).toHaveProperty('description');
        // Tool specs use inputSchema, not parameters
        expect(toolSpec).toHaveProperty('inputSchema');
        expect(typeof toolSpec.name).toBe('string');
        expect(typeof toolSpec.description).toBe('string');
      },
      120000
    );
  });
});
