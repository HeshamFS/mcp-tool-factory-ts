/**
 * Supported LLM providers.
 */
export enum LLMProvider {
  ANTHROPIC = 'anthropic',
  CLAUDE_CODE = 'claude_code',
  OPENAI = 'openai',
  GOOGLE = 'google',
  MISTRAL = 'mistral',
  DEEPSEEK = 'deepseek',
  GROQ = 'groq',
  XAI = 'xai',
  AZURE = 'azure',
  COHERE = 'cohere',
}

/**
 * Available Claude models (2025-2026).
 * @see https://docs.anthropic.com/en/docs/about-claude/models
 */
export const CLAUDE_MODELS: Record<string, string> = {
  // Claude 4.6 Series (Latest - 2026)
  'claude-opus-4-6': 'Claude Opus 4.6 - Most intelligent, adaptive thinking (recommended)',
  // Claude 4.5 Series (2025)
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5 - Best for agents & coding',
  'claude-opus-4-5-20251101': 'Claude Opus 4.5 - Previous most intelligent',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5 - Fastest, near-frontier performance',
  // Claude 4.1 Series (2025)
  'claude-opus-4-1-20250805': 'Claude Opus 4.1 - Aug 2025',
  // Claude 4.0 Series (2025)
  'claude-sonnet-4-20250514': 'Claude Sonnet 4.0 - May 2025',
  'claude-opus-4-20250514': 'Claude Opus 4.0 - May 2025',
  // Claude 3.7 Series (2025)
  'claude-3-7-sonnet-20250219': 'Claude 3.7 Sonnet - Feb 2025',
};

/**
 * Available OpenAI models (2025-2026, GPT-5+ and o-series only).
 * @see https://platform.openai.com/docs/models
 */
export const OPENAI_MODELS: Record<string, string> = {
  // GPT-5.2 Series (Latest - Dec 2025)
  'gpt-5.2': 'GPT-5.2 - Most capable, 400K context (recommended)',
  'gpt-5.2-codex': 'GPT-5.2-Codex - Advanced agentic coding',
  // GPT-5.1 Series (Nov 2025)
  'gpt-5.1': 'GPT-5.1 - 76.3% SWE-bench, reasoning control',
  'gpt-5.1-codex': 'GPT-5.1-Codex - Code generation',
  // GPT-5 Series (Base - 2025)
  'gpt-5': 'GPT-5 - 74.9% SWE-bench, state-of-the-art coding',
  'gpt-5-mini': 'GPT-5 Mini - Fast, efficient',
  'gpt-5-nano': 'GPT-5 Nano - Ultra-fast, cheapest',
  // o-Series Reasoning Models (2025)
  'o3': 'o3 - Reasoning for math, science, coding',
  'o3-mini': 'o3 Mini - Small reasoning, optimized for STEM',
  'o3-pro': 'o3 Pro - Higher-compute for harder problems',
  'o4-mini': 'o4 Mini - Fast, cost-efficient reasoning',
};

/**
 * Available Google Gemini models (2025-2026, 2.5+ only).
 * @see https://ai.google.dev/gemini-api/docs/models
 */
export const GOOGLE_MODELS: Record<string, string> = {
  // Gemini 3 Series (Latest - 2026 Preview)
  'gemini-3-pro-preview': 'Gemini 3 Pro - State-of-the-art reasoning, 1M context (recommended)',
  'gemini-3-flash-preview': 'Gemini 3 Flash - Pro intelligence at Flash speed',
  // Gemini 2.5 Series (2025 - Production)
  'gemini-2.5-pro': 'Gemini 2.5 Pro - Advanced reasoning, 1M context',
  'gemini-2.5-flash': 'Gemini 2.5 Flash - Fast with controllable thinking, 1M context',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite - Lowest cost, massive scale',
};

/**
 * Available Mistral models (2025-2026).
 * @see https://docs.mistral.ai/getting-started/models
 */
export const MISTRAL_MODELS: Record<string, string> = {
  // Flagship (2025)
  'mistral-large-2411': 'Mistral Large - Top-tier reasoning, function calling (recommended)',
  'mistral-large-latest': 'Mistral Large Latest - Alias for latest large',
  // Efficient (2025)
  'mistral-small-2506': 'Mistral Small - 24B params, improved function calling',
  'mistral-small-latest': 'Mistral Small Latest - Alias for latest small',
  'mistral-medium-latest': 'Mistral Medium - Mid-tier general purpose',
  // Reasoning (2025)
  'magistral-medium-2506': 'Magistral Medium - Multi-step reasoning, chain-of-thought',
  'magistral-small-2506': 'Magistral Small - Cost-efficient reasoning',
  // Code (2025)
  'codestral-2508': 'Codestral - Code generation, 80+ languages, FIM support',
  'codestral-latest': 'Codestral Latest - Alias for latest codestral',
  // Multimodal (2025)
  'pixtral-large-2411': 'Pixtral Large - 124B multimodal, frontier image understanding',
};

/**
 * Available DeepSeek models (2025-2026).
 * @see https://api-docs.deepseek.com/
 */
export const DEEPSEEK_MODELS: Record<string, string> = {
  // V3.2 (Latest - 2025)
  'deepseek-chat': 'DeepSeek Chat - V3.2 general purpose, 671B MoE (recommended)',
  'deepseek-reasoner': 'DeepSeek Reasoner - V3.2 extended reasoning, chain-of-thought',
};

/**
 * Available Groq models (2025-2026).
 * @see https://console.groq.com/docs/models
 */
export const GROQ_MODELS: Record<string, string> = {
  // Production
  'llama-3.3-70b-versatile': 'Llama 3.3 70B - 128K context, ultra-fast (recommended)',
  'llama-3.1-8b-instant': 'Llama 3.1 8B - Ultra-fast for simple tasks',
  // Llama 4 (2025 Preview)
  'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick - 128 experts MoE, multimodal',
  'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout - 16 experts MoE, multimodal',
  // Community (2025)
  'qwen/qwen-3-32b': 'Qwen 3 32B - Alibaba, general purpose',
  'deepseek-r1-distill-llama-70b': 'DeepSeek R1 Distill Llama 70B - Reasoning',
  'qwen-qwq-32b': 'Qwen QwQ 32B - Reasoning model',
};

/**
 * Available xAI Grok models (2025-2026).
 * @see https://docs.x.ai/developers/models
 */
export const XAI_MODELS: Record<string, string> = {
  // Grok 4 Series (Latest - 2025)
  'grok-4-0709': 'Grok 4 - Flagship reasoning model (recommended)',
  'grok-4-fast-reasoning': 'Grok 4 Fast - Optimized reasoning speed',
  'grok-4-fast-non-reasoning': 'Grok 4 Fast - No extended reasoning',
  'grok-4-1-fast-reasoning': 'Grok 4.1 Fast - Latest fast reasoning',
  // Grok 3 Series (2025)
  'grok-3-beta': 'Grok 3 Beta - General purpose, 131K context',
  'grok-3-mini-beta': 'Grok 3 Mini Beta - Faster, 131K context',
  // Specialized
  'grok-code-fast-1': 'Grok Code Fast - Specialized code generation',
};

/**
 * Available Cohere models (2025-2026).
 * @see https://docs.cohere.com/docs/models
 */
export const COHERE_MODELS: Record<string, string> = {
  // Command A Series (Latest - 2025)
  'command-a-03-2025': 'Command A - 111B, strongest, 256K context (recommended)',
  'command-a-vision-07-2025': 'Command A Vision - Multimodal, 128K context, OCR',
  'command-a-reasoning': 'Command A Reasoning - Chain-of-thought thinking',
  // Command R Series (2025)
  'command-r-plus-08-2024': 'Command R+ - Previous flagship, still available',
  'command-r-08-2024': 'Command R - Standard model',
  'command-r7b-12-2024': 'Command R 7B - Smallest, fastest, edge deployment',
};

/**
 * Default models per provider.
 */
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  [LLMProvider.ANTHROPIC]: 'claude-sonnet-4-5-20250929',
  [LLMProvider.CLAUDE_CODE]: 'claude-sonnet-4-5-20250929',
  [LLMProvider.OPENAI]: 'gpt-5.2',
  [LLMProvider.GOOGLE]: 'gemini-3-pro-preview',
  [LLMProvider.MISTRAL]: 'mistral-large-2411',
  [LLMProvider.DEEPSEEK]: 'deepseek-chat',
  [LLMProvider.GROQ]: 'llama-3.3-70b-versatile',
  [LLMProvider.XAI]: 'grok-4-0709',
  [LLMProvider.AZURE]: 'gpt-4o',
  [LLMProvider.COHERE]: 'command-a-03-2025',
};

/**
 * Environment variable names for API keys.
 */
export const API_KEY_ENV_VARS: Record<LLMProvider, string> = {
  [LLMProvider.ANTHROPIC]: 'ANTHROPIC_API_KEY',
  [LLMProvider.CLAUDE_CODE]: 'CLAUDE_CODE_OAUTH_TOKEN',
  [LLMProvider.OPENAI]: 'OPENAI_API_KEY',
  [LLMProvider.GOOGLE]: 'GOOGLE_API_KEY',
  [LLMProvider.MISTRAL]: 'MISTRAL_API_KEY',
  [LLMProvider.DEEPSEEK]: 'DEEPSEEK_API_KEY',
  [LLMProvider.GROQ]: 'GROQ_API_KEY',
  [LLMProvider.XAI]: 'XAI_API_KEY',
  [LLMProvider.AZURE]: 'AZURE_OPENAI_API_KEY',
  [LLMProvider.COHERE]: 'COHERE_API_KEY',
};
