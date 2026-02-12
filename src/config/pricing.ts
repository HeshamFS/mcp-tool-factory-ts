/**
 * Model pricing table and cost calculation utilities.
 *
 * Prices are per 1M tokens in USD. Updated manually when providers change pricing.
 */

/**
 * Pricing information for a single model.
 */
export interface ModelPricing {
  /** Cost per 1M input tokens */
  inputPer1M: number;
  /** Cost per 1M output tokens */
  outputPer1M: number;
  /** Cost per 1M cached input tokens (prompt caching) */
  cacheReadPer1M?: number;
  /** Cost per 1M cache write tokens */
  cacheWritePer1M?: number;
  /** Cost per 1M reasoning/thinking tokens */
  reasoningPer1M?: number;
}

/**
 * Detailed token breakdown from AI SDK usage.
 */
export interface TokenDetails {
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
}

/**
 * Breakdown of costs by category.
 */
export interface CostBreakdown {
  /** Total estimated cost in USD */
  total: number;
  /** Cost for input tokens */
  input: number;
  /** Cost for output tokens */
  output: number;
  /** Cost for cached input tokens */
  cacheRead?: number;
  /** Cost for cache write tokens */
  cacheWrite?: number;
  /** Cost for reasoning tokens */
  reasoning?: number;
}

/**
 * Static pricing table for all supported models.
 *
 * Prices in USD per 1M tokens. Sources:
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/pricing
 * - OpenAI: https://platform.openai.com/docs/pricing
 * - Google: https://ai.google.dev/gemini-api/docs/pricing
 * - Mistral: https://docs.mistral.ai/getting-started/pricing
 * - DeepSeek: https://api-docs.deepseek.com/pricing
 * - Groq: https://console.groq.com/docs/pricing
 * - xAI: https://docs.x.ai/developers/pricing
 * - Cohere: https://docs.cohere.com/docs/pricing
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // --- Anthropic ---
  'claude-opus-4-6': { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.50, cacheWritePer1M: 18.75 },
  'claude-sonnet-4-5-20250929': { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.30, cacheWritePer1M: 3.75 },
  'claude-opus-4-5-20251101': { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.50, cacheWritePer1M: 18.75 },
  'claude-haiku-4-5-20251001': { inputPer1M: 0.80, outputPer1M: 4, cacheReadPer1M: 0.08, cacheWritePer1M: 1.00 },
  'claude-opus-4-1-20250805': { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.50, cacheWritePer1M: 18.75 },
  'claude-sonnet-4-20250514': { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.30, cacheWritePer1M: 3.75 },
  'claude-opus-4-20250514': { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.50, cacheWritePer1M: 18.75 },
  'claude-3-7-sonnet-20250219': { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.30, cacheWritePer1M: 3.75 },

  // --- OpenAI ---
  'gpt-5.2': { inputPer1M: 2, outputPer1M: 8 },
  'gpt-5.2-codex': { inputPer1M: 2, outputPer1M: 8 },
  'gpt-5.1': { inputPer1M: 2, outputPer1M: 8 },
  'gpt-5.1-codex': { inputPer1M: 2, outputPer1M: 8 },
  'gpt-5': { inputPer1M: 2, outputPer1M: 8 },
  'gpt-5-mini': { inputPer1M: 0.40, outputPer1M: 1.60 },
  'gpt-5-nano': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'o3': { inputPer1M: 10, outputPer1M: 40, reasoningPer1M: 15 },
  'o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40, reasoningPer1M: 4.40 },
  'o3-pro': { inputPer1M: 20, outputPer1M: 80, reasoningPer1M: 20 },
  'o4-mini': { inputPer1M: 1.10, outputPer1M: 4.40, reasoningPer1M: 4.40 },

  // --- Google ---
  'gemini-3-pro-preview': { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.31 },
  'gemini-3-flash-preview': { inputPer1M: 0.15, outputPer1M: 0.60, cacheReadPer1M: 0.04 },
  'gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10, cacheReadPer1M: 0.31 },
  'gemini-2.5-flash': { inputPer1M: 0.15, outputPer1M: 0.60, cacheReadPer1M: 0.04 },
  'gemini-2.5-flash-lite': { inputPer1M: 0.075, outputPer1M: 0.30 },

  // --- Mistral ---
  'mistral-large-2411': { inputPer1M: 2, outputPer1M: 6 },
  'mistral-large-latest': { inputPer1M: 2, outputPer1M: 6 },
  'mistral-small-2506': { inputPer1M: 0.10, outputPer1M: 0.30 },
  'mistral-small-latest': { inputPer1M: 0.10, outputPer1M: 0.30 },
  'mistral-medium-latest': { inputPer1M: 2.70, outputPer1M: 8.10 },
  'magistral-medium-2506': { inputPer1M: 2, outputPer1M: 5 },
  'magistral-small-2506': { inputPer1M: 0.50, outputPer1M: 1.50 },
  'codestral-2508': { inputPer1M: 0.30, outputPer1M: 0.90 },
  'codestral-latest': { inputPer1M: 0.30, outputPer1M: 0.90 },
  'pixtral-large-2411': { inputPer1M: 2, outputPer1M: 6 },

  // --- DeepSeek ---
  'deepseek-chat': { inputPer1M: 0.27, outputPer1M: 1.10, cacheReadPer1M: 0.07 },
  'deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19, reasoningPer1M: 2.19 },

  // --- Groq ---
  'llama-3.3-70b-versatile': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'llama-3.1-8b-instant': { inputPer1M: 0.05, outputPer1M: 0.08 },
  'meta-llama/llama-4-maverick-17b-128e-instruct': { inputPer1M: 0.50, outputPer1M: 0.77 },
  'meta-llama/llama-4-scout-17b-16e-instruct': { inputPer1M: 0.11, outputPer1M: 0.34 },
  'qwen/qwen-3-32b': { inputPer1M: 0.29, outputPer1M: 0.39 },
  'deepseek-r1-distill-llama-70b': { inputPer1M: 0.59, outputPer1M: 0.79 },
  'qwen-qwq-32b': { inputPer1M: 0.29, outputPer1M: 0.39 },

  // --- xAI ---
  'grok-4-0709': { inputPer1M: 2, outputPer1M: 10 },
  'grok-4-fast-reasoning': { inputPer1M: 2, outputPer1M: 10 },
  'grok-4-fast-non-reasoning': { inputPer1M: 2, outputPer1M: 10 },
  'grok-4-1-fast-reasoning': { inputPer1M: 2, outputPer1M: 10 },
  'grok-3-beta': { inputPer1M: 3, outputPer1M: 15 },
  'grok-3-mini-beta': { inputPer1M: 0.30, outputPer1M: 0.50 },
  'grok-code-fast-1': { inputPer1M: 2, outputPer1M: 10 },

  // --- Cohere ---
  'command-a-03-2025': { inputPer1M: 2.50, outputPer1M: 10 },
  'command-a-vision-07-2025': { inputPer1M: 2.50, outputPer1M: 10 },
  'command-a-reasoning': { inputPer1M: 2.50, outputPer1M: 10 },
  'command-r-plus-08-2024': { inputPer1M: 2.50, outputPer1M: 10 },
  'command-r-08-2024': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'command-r7b-12-2024': { inputPer1M: 0.0375, outputPer1M: 0.15 },

  // --- Azure (same as OpenAI pricing) ---
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10 },
};

/**
 * Calculate the estimated cost for an LLM call.
 *
 * @param model - Model identifier
 * @param tokensIn - Number of input tokens
 * @param tokensOut - Number of output tokens
 * @param details - Optional detailed token breakdown
 * @returns Cost breakdown or null if model pricing is unknown
 */
export function calculateCost(
  model: string,
  tokensIn: number,
  tokensOut: number,
  details?: TokenDetails | null
): CostBreakdown | null {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return null;

  let inputTokens = tokensIn;
  let inputCost: number;
  let cacheReadCost: number | undefined;
  let cacheWriteCost: number | undefined;
  let reasoningCost: number | undefined;

  // Subtract cached tokens from input if available
  if (details?.cacheReadTokens && pricing.cacheReadPer1M !== undefined) {
    const cacheReadTokens = details.cacheReadTokens;
    inputTokens = Math.max(0, inputTokens - cacheReadTokens);
    cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cacheReadPer1M;
  }

  if (details?.cacheWriteTokens && pricing.cacheWritePer1M !== undefined) {
    const cacheWriteTokens = details.cacheWriteTokens;
    cacheWriteCost = (cacheWriteTokens / 1_000_000) * pricing.cacheWritePer1M;
  }

  inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;

  // Output tokens: subtract reasoning tokens if priced separately
  let outputTokens = tokensOut;
  if (details?.reasoningTokens && pricing.reasoningPer1M !== undefined) {
    const reasoningTokens = details.reasoningTokens;
    outputTokens = Math.max(0, outputTokens - reasoningTokens);
    reasoningCost = (reasoningTokens / 1_000_000) * pricing.reasoningPer1M;
  }

  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  const total = inputCost + outputCost + (cacheReadCost ?? 0) + (cacheWriteCost ?? 0) + (reasoningCost ?? 0);

  return {
    total,
    input: inputCost,
    output: outputCost,
    cacheRead: cacheReadCost,
    cacheWrite: cacheWriteCost,
    reasoning: reasoningCost,
  };
}

/**
 * Format a cost value as a human-readable USD string.
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(4)}`;
}

/**
 * Estimate cost for a generation using average token counts.
 * Useful for cost comparison before generation.
 *
 * @param model - Model identifier
 * @param estimatedInputTokens - Estimated total input tokens across all calls
 * @param estimatedOutputTokens - Estimated total output tokens across all calls
 * @returns Estimated total cost or null if pricing unknown
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number | null {
  const result = calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
  return result?.total ?? null;
}
