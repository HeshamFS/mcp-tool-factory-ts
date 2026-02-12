/**
 * Tests for cost tracking and pricing utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  MODEL_PRICING,
  calculateCost,
  formatCost,
  estimateCost,
  type TokenDetails,
  type CostBreakdown,
} from '../src/config/pricing.js';
import {
  CLAUDE_MODELS,
  OPENAI_MODELS,
  GOOGLE_MODELS,
  MISTRAL_MODELS,
  DEEPSEEK_MODELS,
  GROQ_MODELS,
  XAI_MODELS,
  COHERE_MODELS,
} from '../src/config/providers.js';

describe('Pricing Table', () => {
  it('should have pricing for all Claude models', () => {
    for (const model of Object.keys(CLAUDE_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
      expect(MODEL_PRICING[model].inputPer1M).toBeGreaterThan(0);
      expect(MODEL_PRICING[model].outputPer1M).toBeGreaterThan(0);
    }
  });

  it('should have pricing for all OpenAI models', () => {
    for (const model of Object.keys(OPENAI_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
      expect(MODEL_PRICING[model].inputPer1M).toBeGreaterThan(0);
      expect(MODEL_PRICING[model].outputPer1M).toBeGreaterThan(0);
    }
  });

  it('should have pricing for all Google models', () => {
    for (const model of Object.keys(GOOGLE_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
    }
  });

  it('should have pricing for all Mistral models', () => {
    for (const model of Object.keys(MISTRAL_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
    }
  });

  it('should have pricing for all DeepSeek models', () => {
    for (const model of Object.keys(DEEPSEEK_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
    }
  });

  it('should have pricing for all Groq models', () => {
    for (const model of Object.keys(GROQ_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
    }
  });

  it('should have pricing for all xAI models', () => {
    for (const model of Object.keys(XAI_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
    }
  });

  it('should have pricing for all Cohere models', () => {
    for (const model of Object.keys(COHERE_MODELS)) {
      expect(MODEL_PRICING[model], `Missing pricing for ${model}`).toBeDefined();
    }
  });

  it('should have cache pricing for Anthropic models', () => {
    const anthropicModels = Object.keys(CLAUDE_MODELS);
    for (const model of anthropicModels) {
      const pricing = MODEL_PRICING[model];
      expect(pricing.cacheReadPer1M, `Missing cacheReadPer1M for ${model}`).toBeDefined();
      expect(pricing.cacheWritePer1M, `Missing cacheWritePer1M for ${model}`).toBeDefined();
    }
  });

  it('should have reasoning pricing for o-series models', () => {
    const reasoningModels = ['o3', 'o3-mini', 'o3-pro', 'o4-mini'];
    for (const model of reasoningModels) {
      const pricing = MODEL_PRICING[model];
      expect(pricing.reasoningPer1M, `Missing reasoningPer1M for ${model}`).toBeDefined();
      expect(pricing.reasoningPer1M!).toBeGreaterThan(0);
    }
  });
});

describe('calculateCost', () => {
  it('should calculate basic input/output cost', () => {
    const result = calculateCost('claude-sonnet-4-5-20250929', 10000, 5000);
    expect(result).not.toBeNull();
    // $3/1M input + $15/1M output
    // 10000 * 3/1M = $0.03 input
    // 5000 * 15/1M = $0.075 output
    // Total = $0.105
    expect(result!.total).toBeCloseTo(0.105, 4);
    expect(result!.input).toBeCloseTo(0.03, 4);
    expect(result!.output).toBeCloseTo(0.075, 4);
  });

  it('should return null for unknown models', () => {
    const result = calculateCost('unknown-model-xyz', 10000, 5000);
    expect(result).toBeNull();
  });

  it('should handle zero tokens', () => {
    const result = calculateCost('claude-sonnet-4-5-20250929', 0, 0);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(0);
  });

  it('should calculate cost with cache read tokens', () => {
    const details: TokenDetails = { cacheReadTokens: 8000 };
    const result = calculateCost('claude-sonnet-4-5-20250929', 10000, 5000, details);
    expect(result).not.toBeNull();
    // Input: (10000 - 8000) * 3/1M = 2000 * 3/1M = $0.006
    // Cache read: 8000 * 0.30/1M = $0.0024
    // Output: 5000 * 15/1M = $0.075
    // Total = $0.006 + $0.0024 + $0.075 = $0.0834
    expect(result!.input).toBeCloseTo(0.006, 4);
    expect(result!.cacheRead).toBeCloseTo(0.0024, 4);
    expect(result!.output).toBeCloseTo(0.075, 4);
    expect(result!.total).toBeCloseTo(0.0834, 4);
  });

  it('should calculate cost with cache write tokens', () => {
    const details: TokenDetails = { cacheWriteTokens: 5000 };
    const result = calculateCost('claude-sonnet-4-5-20250929', 10000, 5000, details);
    expect(result).not.toBeNull();
    // Cache write: 5000 * 3.75/1M = $0.01875
    expect(result!.cacheWrite).toBeCloseTo(0.01875, 5);
  });

  it('should calculate cost with reasoning tokens', () => {
    const details: TokenDetails = { reasoningTokens: 3000 };
    const result = calculateCost('o3', 10000, 8000, details);
    expect(result).not.toBeNull();
    // Input: 10000 * 10/1M = $0.10
    // Output: (8000 - 3000) * 40/1M = 5000 * 40/1M = $0.20
    // Reasoning: 3000 * 15/1M = $0.045
    // Total = $0.10 + $0.20 + $0.045 = $0.345
    expect(result!.input).toBeCloseTo(0.10, 4);
    expect(result!.output).toBeCloseTo(0.20, 4);
    expect(result!.reasoning).toBeCloseTo(0.045, 4);
    expect(result!.total).toBeCloseTo(0.345, 4);
  });

  it('should handle null details gracefully', () => {
    const result = calculateCost('gpt-5.2', 10000, 5000, null);
    expect(result).not.toBeNull();
    expect(result!.total).toBeGreaterThan(0);
    expect(result!.cacheRead).toBeUndefined();
    expect(result!.reasoning).toBeUndefined();
  });
});

describe('formatCost', () => {
  it('should format zero cost', () => {
    expect(formatCost(0)).toBe('$0.00');
  });

  it('should format sub-cent costs', () => {
    expect(formatCost(0.005)).toBe('<$0.01');
    expect(formatCost(0.001)).toBe('<$0.01');
  });

  it('should format normal costs with 4 decimal places', () => {
    expect(formatCost(0.1234)).toBe('$0.1234');
    expect(formatCost(1.50)).toBe('$1.5000');
  });

  it('should format very small positive costs', () => {
    expect(formatCost(0.0001)).toBe('<$0.01');
  });
});

describe('estimateCost', () => {
  it('should estimate cost for known models', () => {
    const cost = estimateCost('claude-sonnet-4-5-20250929', 15000, 10000);
    expect(cost).not.toBeNull();
    // $3/1M * 15K + $15/1M * 10K = $0.045 + $0.15 = $0.195
    expect(cost!).toBeCloseTo(0.195, 4);
  });

  it('should return null for unknown models', () => {
    const cost = estimateCost('nonexistent-model', 15000, 10000);
    expect(cost).toBeNull();
  });

  it('should show Groq is cheapest for typical usage', () => {
    const groqCost = estimateCost('llama-3.1-8b-instant', 15000, 10000);
    const claudeCost = estimateCost('claude-sonnet-4-5-20250929', 15000, 10000);
    expect(groqCost).not.toBeNull();
    expect(claudeCost).not.toBeNull();
    expect(groqCost!).toBeLessThan(claudeCost!);
  });
});

describe('LLMResponse cost field', () => {
  it('should accept cost and tokenDetails fields', () => {
    // Type-level test: verify the interface accepts cost fields
    const response: import('../src/providers/base.js').LLMResponse = {
      text: 'test',
      latencyMs: 100,
      tokensIn: 1000,
      tokensOut: 500,
      cost: 0.05,
      tokenDetails: {
        cacheReadTokens: 100,
        cacheWriteTokens: 200,
        reasoningTokens: 50,
      },
    };
    expect(response.cost).toBe(0.05);
    expect(response.tokenDetails?.cacheReadTokens).toBe(100);
  });
});

describe('GenerationLog cost fields', () => {
  it('should track cost in GenerationLog', async () => {
    const { createGenerationLog } = await import('../src/models/generation-log.js');
    const log = createGenerationLog('test-server');
    expect(log.totalCost).toBe(0);
    expect(log.totalTokensIn).toBe(0);
    expect(log.totalTokensOut).toBe(0);
    expect(log.llmCallCount).toBe(0);
    expect(log.costBreakdown).toEqual([]);
  });
});

describe('ExecutionLogger cost tracking', () => {
  it('should accumulate costs across LLM calls', async () => {
    const { createExecutionLogger } = await import('../src/execution-logger/index.js');
    const logger = createExecutionLogger('test', 'anthropic', 'claude-sonnet-4-5-20250929');

    logger.logLlmCall({
      systemPrompt: 'sys',
      userPrompt: 'user1',
      rawResponse: 'resp1',
      tokensIn: 1000,
      tokensOut: 500,
      cost: 0.0105,
      phase: 'tool_extraction',
    });

    logger.logLlmCall({
      systemPrompt: 'sys',
      userPrompt: 'user2',
      rawResponse: 'resp2',
      tokensIn: 2000,
      tokensOut: 1000,
      cost: 0.021,
      phase: 'implementation',
    });

    expect(logger.totalCost).toBeCloseTo(0.0315, 4);
    expect(logger.totalTokensIn).toBe(3000);
    expect(logger.totalTokensOut).toBe(1500);
    expect(logger.costByPhase['tool_extraction']).toEqual({ cost: 0.0105, calls: 1 });
    expect(logger.costByPhase['implementation']).toEqual({ cost: 0.021, calls: 1 });
  });

  it('should include cost in markdown output', async () => {
    const { createExecutionLogger } = await import('../src/execution-logger/index.js');
    const logger = createExecutionLogger('test', 'anthropic', 'claude-sonnet-4-5-20250929');

    logger.logLlmCall({
      systemPrompt: 'sys',
      userPrompt: 'user',
      rawResponse: 'resp',
      tokensIn: 1000,
      tokensOut: 500,
      cost: 0.0105,
      phase: 'tool_extraction',
    });

    const markdown = logger.toMarkdown();
    expect(markdown).toContain('Estimated Cost');
    expect(markdown).toContain('$0.0105');
    expect(markdown).toContain('Cost Breakdown');
    expect(markdown).toContain('tool_extraction');
  });

  it('should include cost in JSON output', async () => {
    const { createExecutionLogger } = await import('../src/execution-logger/index.js');
    const logger = createExecutionLogger('test', 'anthropic', 'claude-sonnet-4-5-20250929');

    logger.logLlmCall({
      systemPrompt: 'sys',
      userPrompt: 'user',
      rawResponse: 'resp',
      cost: 0.05,
      phase: 'implementation',
    });

    const json = JSON.parse(logger.toJson());
    expect(json.summary.totalCost).toBeCloseTo(0.05, 4);
    expect(json.summary.costByPhase.implementation).toEqual({ cost: 0.05, calls: 1 });
  });
});
