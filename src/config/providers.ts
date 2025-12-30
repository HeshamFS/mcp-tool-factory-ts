/**
 * Supported LLM providers.
 */
export enum LLMProvider {
  ANTHROPIC = 'anthropic',
  CLAUDE_CODE = 'claude_code',
  OPENAI = 'openai',
  GOOGLE = 'google',
}

/**
 * Available Claude models.
 * @see https://docs.anthropic.com/en/docs/about-claude/models
 */
export const CLAUDE_MODELS: Record<string, string> = {
  // Claude 4.5 Series (Latest)
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 - Best for agents & coding (recommended)',
  'claude-opus-4-5-20251101': 'Claude Opus 4.5 - Most intelligent',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5 - Fastest, near-frontier performance',
};

/**
 * Available OpenAI models (GPT-5+ only).
 * @see https://platform.openai.com/docs/models
 */
export const OPENAI_MODELS: Record<string, string> = {
  // GPT-5.2 Series (Latest - Dec 2025)
  'gpt-5.2': 'GPT-5.2 - Most capable, 400K context (recommended)',
  'gpt-5.2-codex': 'GPT-5.2-Codex - Advanced agentic coding',
  // GPT-5.1 Series (Nov 2025)
  'gpt-5.1': 'GPT-5.1 - 76.3% SWE-bench, reasoning control',
  // GPT-5 Series (Base)
  'gpt-5': 'GPT-5 - 74.9% SWE-bench, state-of-the-art coding',
  'gpt-5-mini': 'GPT-5 Mini - Fast, efficient',
  'gpt-5-nano': 'GPT-5 Nano - Ultra-fast, cheapest',
};

/**
 * Available Google Gemini models (2.5+ only).
 * @see https://ai.google.dev/gemini-api/docs/models
 */
export const GOOGLE_MODELS: Record<string, string> = {
  // Gemini 3 Series (Latest - Preview)
  'gemini-3-flash-preview': 'Gemini 3 Flash - Pro-level intelligence, Flash speed (recommended)',
  'gemini-3-pro-preview': 'Gemini 3 Pro - Best for complex reasoning tasks',
  // Gemini 2.5 Series
  'gemini-2.5-flash': 'Gemini 2.5 Flash - Fast multimodal',
  'gemini-2.5-pro': 'Gemini 2.5 Pro - Advanced reasoning',
};

/**
 * Default models per provider.
 */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  [LLMProvider.ANTHROPIC]: 'claude-sonnet-4-5-20250929',
  [LLMProvider.CLAUDE_CODE]: 'claude-sonnet-4-5-20250929',
  [LLMProvider.OPENAI]: 'gpt-5.2',
  [LLMProvider.GOOGLE]: 'gemini-3-flash-preview',
};

/**
 * Environment variable names for API keys.
 */
export const API_KEY_ENV_VARS: Record<LLMProvider, string> = {
  [LLMProvider.ANTHROPIC]: 'ANTHROPIC_API_KEY',
  [LLMProvider.CLAUDE_CODE]: 'CLAUDE_CODE_OAUTH_TOKEN',
  [LLMProvider.OPENAI]: 'OPENAI_API_KEY',
  [LLMProvider.GOOGLE]: 'GOOGLE_API_KEY',
};
