/**
 * Provider factory for creating LLM providers.
 */

import { LLMProvider } from '../config/providers.js';
import type { LLMProviderInterface, ProviderOptions } from './base.js';
import { ClaudeCodeProvider } from './claude-code.js';
import { UnifiedLLMProvider } from './llm-provider.js';

/**
 * Create an LLM provider instance based on the provider type.
 *
 * ClaudeCode uses its own SDK-based provider. All other providers
 * are handled by the unified Vercel AI SDK provider.
 *
 * @param provider - The provider type (enum or string)
 * @param options - Provider options including apiKey and model
 * @returns Configured provider instance
 * @throws Error if provider type is not supported
 */
export function createProvider(
  provider: LLMProvider | string,
  options: ProviderOptions
): LLMProviderInterface {
  const providerEnum =
    typeof provider === 'string' ? (provider as LLMProvider) : provider;

  if (providerEnum === LLMProvider.CLAUDE_CODE) {
    return new ClaudeCodeProvider(options);
  }

  // Validate it's a known provider
  if (!Object.values(LLMProvider).includes(providerEnum)) {
    throw new Error(`Unsupported provider: ${providerEnum}`);
  }

  return new UnifiedLLMProvider(providerEnum, options);
}

/**
 * Check if a provider SDK is available.
 */
export async function isProviderAvailable(provider: LLMProvider): Promise<boolean> {
  const packageMap: Partial<Record<LLMProvider, string>> = {
    [LLMProvider.ANTHROPIC]: '@ai-sdk/anthropic',
    [LLMProvider.OPENAI]: '@ai-sdk/openai',
    [LLMProvider.GOOGLE]: '@ai-sdk/google',
    [LLMProvider.MISTRAL]: '@ai-sdk/mistral',
    [LLMProvider.DEEPSEEK]: '@ai-sdk/deepseek',
    [LLMProvider.GROQ]: '@ai-sdk/groq',
    [LLMProvider.XAI]: '@ai-sdk/xai',
    [LLMProvider.AZURE]: '@ai-sdk/azure',
    [LLMProvider.COHERE]: '@ai-sdk/cohere',
    [LLMProvider.CLAUDE_CODE]: '@anthropic-ai/claude-agent-sdk',
  };

  const pkg = packageMap[provider];
  if (!pkg) return false;

  try {
    await import(pkg);
    return true;
  } catch {
    return false;
  }
}
