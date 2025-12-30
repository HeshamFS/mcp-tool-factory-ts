/**
 * Provider factory for creating LLM providers.
 */

import { LLMProvider } from '../config/providers.js';
import type { BaseLLMProvider, ProviderOptions } from './base.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { GoogleProvider } from './google.js';
import { ClaudeCodeProvider } from './claude-code.js';

/**
 * Create an LLM provider instance based on the provider type.
 *
 * @param provider - The provider type (enum or string)
 * @param options - Provider options including apiKey and model
 * @returns Configured provider instance
 * @throws Error if provider type is not supported
 */
export function createProvider(
  provider: LLMProvider | string,
  options: ProviderOptions
): BaseLLMProvider {
  // Convert string to enum if needed
  const providerEnum =
    typeof provider === 'string' ? (provider as LLMProvider) : provider;

  switch (providerEnum) {
    case LLMProvider.ANTHROPIC:
      return new AnthropicProvider(options);
    case LLMProvider.CLAUDE_CODE:
      return new ClaudeCodeProvider(options);
    case LLMProvider.OPENAI:
      return new OpenAIProvider(options);
    case LLMProvider.GOOGLE:
      return new GoogleProvider(options);
    default:
      throw new Error(`Unsupported provider: ${providerEnum}`);
  }
}

/**
 * Check if a provider SDK is available.
 */
export async function isProviderAvailable(provider: LLMProvider): Promise<boolean> {
  try {
    switch (provider) {
      case LLMProvider.ANTHROPIC: {
        const mod = '@anthropic-ai/sdk';
        await import(mod);
        return true;
      }
      case LLMProvider.CLAUDE_CODE: {
        const mod = 'claude-agent-sdk';
        await import(mod);
        return true;
      }
      case LLMProvider.OPENAI: {
        const mod = 'openai';
        await import(mod);
        return true;
      }
      case LLMProvider.GOOGLE: {
        const mod = '@google/generative-ai';
        await import(mod);
        return true;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}
