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

  if (config.provider === LLMProvider.ANTHROPIC && !(config.model in CLAUDE_MODELS)) {
    errors.push(
      `Unknown Claude model: ${config.model}. Available: ${Object.keys(CLAUDE_MODELS).join(', ')}`
    );
  }

  if (config.provider === LLMProvider.OPENAI && !(config.model in OPENAI_MODELS)) {
    errors.push(
      `Unknown OpenAI model: ${config.model}. Available: ${Object.keys(OPENAI_MODELS).join(', ')}`
    );
  }

  if (config.provider === LLMProvider.GOOGLE && !(config.model in GOOGLE_MODELS)) {
    errors.push(
      `Unknown Google model: ${config.model}. Available: ${Object.keys(GOOGLE_MODELS).join(', ')}`
    );
  }

  return errors;
}

/**
 * Get default configuration from environment.
 * Prefers Claude Code OAuth token first, then falls back to other providers.
 */
export function getDefaultConfig(): FactoryConfig {
  // Check which API key is available
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return createFactoryConfig({ provider: LLMProvider.CLAUDE_CODE });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return createFactoryConfig({ provider: LLMProvider.ANTHROPIC });
  }
  if (process.env.OPENAI_API_KEY) {
    return createFactoryConfig({ provider: LLMProvider.OPENAI });
  }
  if (process.env.GOOGLE_API_KEY) {
    return createFactoryConfig({ provider: LLMProvider.GOOGLE });
  }

  // Default to Anthropic, will fail validation if no key
  return createFactoryConfig({ provider: LLMProvider.ANTHROPIC });
}
