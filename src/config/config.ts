import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import {
  LLMProvider,
  DEFAULT_MODELS,
  API_KEY_ENV_VARS,
  CLAUDE_MODELS,
  OPENAI_MODELS,
  GOOGLE_MODELS,
  MISTRAL_MODELS,
  DEEPSEEK_MODELS,
  GROQ_MODELS,
  XAI_MODELS,
  COHERE_MODELS,
} from './providers.js';

// Load .env file on module import
function loadEnv(): void {
  // Try current directory first
  const cwd = process.cwd();
  const envPath = join(cwd, '.env');

  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
    return;
  }

  // Try parent directories (up to 3 levels)
  let currentDir = cwd;
  for (let i = 0; i < 3; i++) {
    currentDir = dirname(currentDir);
    const parentEnvPath = join(currentDir, '.env');
    if (existsSync(parentEnvPath)) {
      loadDotenv({ path: parentEnvPath });
      return;
    }
  }
}

// Load environment on import
loadEnv();

/**
 * Configuration for the Tool Factory.
 */
export interface FactoryConfig {
  /** LLM provider to use */
  provider: LLMProvider;
  /** Model ID to use for generation */
  model: string;
  /** API key (defaults to env var based on provider) */
  apiKey: string | null;
  /** Maximum tokens for generation */
  maxTokens: number;
  /** Sampling temperature (0-1) */
  temperature: number;
}

/**
 * Create a FactoryConfig with defaults based on provider.
 */
export function createFactoryConfig(
  partial?: Partial<FactoryConfig>
): FactoryConfig {
  const provider = partial?.provider ?? LLMProvider.ANTHROPIC;
  const model = partial?.model ?? DEFAULT_MODELS[provider];
  const apiKey = partial?.apiKey ?? getApiKeyFromEnv(provider);

  return {
    provider,
    model,
    apiKey,
    maxTokens: partial?.maxTokens ?? 4096,
    temperature: partial?.temperature ?? 0.0,
  };
}

/**
 * Get API key from environment variable based on provider.
 */
export function getApiKeyFromEnv(provider: LLMProvider): string | null {
  const envVar = API_KEY_ENV_VARS[provider];
  return process.env[envVar] ?? null;
}

/**
 * Validate configuration. Returns list of errors.
 */
export function validateConfig(config: FactoryConfig): string[] {
  const errors: string[] = [];

  if (!config.apiKey) {
    const envVar = API_KEY_ENV_VARS[config.provider];
    errors.push(
      `API key not set. Set ${envVar} environment variable or pass apiKey parameter.`
    );
  }

  // Validate model against known models (when a known model list exists)
  const modelLists: Partial<Record<LLMProvider, Record<string, string>>> = {
    [LLMProvider.ANTHROPIC]: CLAUDE_MODELS,
    [LLMProvider.OPENAI]: OPENAI_MODELS,
    [LLMProvider.GOOGLE]: GOOGLE_MODELS,
    [LLMProvider.MISTRAL]: MISTRAL_MODELS,
    [LLMProvider.DEEPSEEK]: DEEPSEEK_MODELS,
    [LLMProvider.GROQ]: GROQ_MODELS,
    [LLMProvider.XAI]: XAI_MODELS,
    [LLMProvider.COHERE]: COHERE_MODELS,
  };

  const knownModels = modelLists[config.provider];
  if (knownModels && !(config.model in knownModels)) {
    errors.push(
      `Unknown ${config.provider} model: ${config.model}. Available: ${Object.keys(knownModels).join(', ')}`
    );
  }

  return errors;
}

/**
 * Get default configuration from environment.
 * Prefers Claude Code OAuth token first, then falls back to other providers.
 */
export function getDefaultConfig(): FactoryConfig {
  // Check which API key is available (in priority order)
  const autoDetectOrder: Array<[string, LLMProvider]> = [
    ['CLAUDE_CODE_OAUTH_TOKEN', LLMProvider.CLAUDE_CODE],
    ['ANTHROPIC_API_KEY', LLMProvider.ANTHROPIC],
    ['OPENAI_API_KEY', LLMProvider.OPENAI],
    ['GOOGLE_API_KEY', LLMProvider.GOOGLE],
    ['MISTRAL_API_KEY', LLMProvider.MISTRAL],
    ['DEEPSEEK_API_KEY', LLMProvider.DEEPSEEK],
    ['GROQ_API_KEY', LLMProvider.GROQ],
    ['XAI_API_KEY', LLMProvider.XAI],
    ['AZURE_OPENAI_API_KEY', LLMProvider.AZURE],
    ['COHERE_API_KEY', LLMProvider.COHERE],
  ];

  for (const [envVar, provider] of autoDetectOrder) {
    if (process.env[envVar]) {
      return createFactoryConfig({ provider });
    }
  }

  // Default to Anthropic, will fail validation if no key
  return createFactoryConfig({ provider: LLMProvider.ANTHROPIC });
}
