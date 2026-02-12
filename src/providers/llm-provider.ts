/**
 * Unified LLM Provider using Vercel AI SDK.
 *
 * Handles all AI SDK-backed providers (Anthropic, OpenAI, Google, Mistral,
 * DeepSeek, Groq, xAI, Azure, Cohere) through a single class with lazy
 * dynamic imports.
 */

import { LLMProvider } from '../config/providers.js';
import { calculateCost } from '../config/pricing.js';
import {
  BaseCachingProvider,
  type LLMResponse,
  type ProviderOptions,
  type StreamCallbacks,
} from './base.js';

/**
 * Single provider class for all Vercel AI SDK-backed LLM providers.
 *
 * Uses lazy dynamic imports so only the required @ai-sdk/* package
 * is loaded at runtime. Missing packages produce a clear error message.
 */
export class UnifiedLLMProvider extends BaseCachingProvider {
  private providerEnum: LLMProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private modelInstance: any = null;

  constructor(provider: LLMProvider, options: ProviderOptions) {
    super(options);
    this.providerEnum = provider;
  }

  override get supportsStreaming(): boolean {
    return true;
  }

  override get providerName(): string {
    return this.providerEnum;
  }

  /**
   * Lazily resolve the AI SDK model instance.
   * Dynamic imports keep provider packages optional.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async resolveModel(): Promise<any> {
    if (this.modelInstance) return this.modelInstance;

    try {
      switch (this.providerEnum) {
        case LLMProvider.ANTHROPIC: {
          const { createAnthropic } = await import('@ai-sdk/anthropic');
          const provider = createAnthropic({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.OPENAI: {
          const { createOpenAI } = await import('@ai-sdk/openai');
          const provider = createOpenAI({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.GOOGLE: {
          const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
          const provider = createGoogleGenerativeAI({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.MISTRAL: {
          const { createMistral } = await import('@ai-sdk/mistral');
          const provider = createMistral({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.DEEPSEEK: {
          const { createDeepSeek } = await import('@ai-sdk/deepseek');
          const provider = createDeepSeek({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.GROQ: {
          const { createGroq } = await import('@ai-sdk/groq');
          const provider = createGroq({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.XAI: {
          const { createXai } = await import('@ai-sdk/xai');
          const provider = createXai({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.AZURE: {
          const { createAzure } = await import('@ai-sdk/azure');
          const provider = createAzure({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        case LLMProvider.COHERE: {
          const { createCohere } = await import('@ai-sdk/cohere');
          const provider = createCohere({ apiKey: this.apiKey });
          this.modelInstance = provider(this.model);
          break;
        }
        default:
          throw new Error(`Unsupported AI SDK provider: ${this.providerEnum}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        const pkg = this.getPackageName();
        throw new Error(
          `AI SDK provider package ${pkg} is not installed. ` +
            `Install it with: npm install ${pkg}`
        );
      }
      throw error;
    }

    return this.modelInstance;
  }

  /**
   * Whether this model supports the temperature parameter.
   * OpenAI reasoning models (o-series) and gpt-5.x (responses API) do not.
   */
  private get supportsTemperature(): boolean {
    if (this.providerEnum !== LLMProvider.OPENAI) return true;
    // o-series reasoning models and gpt-5.x (uses OpenAI responses API)
    return !/^(o[34]|gpt-5)/.test(this.model);
  }

  /**
   * Get the npm package name for the current provider.
   */
  private getPackageName(): string {
    const packageMap: Record<string, string> = {
      [LLMProvider.ANTHROPIC]: '@ai-sdk/anthropic',
      [LLMProvider.OPENAI]: '@ai-sdk/openai',
      [LLMProvider.GOOGLE]: '@ai-sdk/google',
      [LLMProvider.MISTRAL]: '@ai-sdk/mistral',
      [LLMProvider.DEEPSEEK]: '@ai-sdk/deepseek',
      [LLMProvider.GROQ]: '@ai-sdk/groq',
      [LLMProvider.XAI]: '@ai-sdk/xai',
      [LLMProvider.AZURE]: '@ai-sdk/azure',
      [LLMProvider.COHERE]: '@ai-sdk/cohere',
    };
    return packageMap[this.providerEnum] ?? `@ai-sdk/${this.providerEnum}`;
  }

  /**
   * Non-streaming LLM call via AI SDK `generateText`.
   */
  protected override async doCall(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    const { generateText } = await import('ai');
    const model = await this.resolveModel();

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: maxTokens,
      ...(this.supportsTemperature ? { temperature: this.temperature } : {}),
    });

    const usage = result.usage;
    const tokensIn = usage?.inputTokens ?? 0;
    const tokensOut = usage?.outputTokens ?? 0;

    // Extract detailed token breakdown from AI SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usageAny = usage as any;
    const tokenDetails = {
      cacheReadTokens: usageAny?.inputTokenDetails?.cacheReadTokens ?? undefined,
      cacheWriteTokens: usageAny?.inputTokenDetails?.cacheWriteTokens ?? undefined,
      reasoningTokens: usageAny?.outputTokenDetails?.reasoningTokens ?? undefined,
    };

    const costBreakdown = calculateCost(this.model, tokensIn, tokensOut, tokenDetails);

    return {
      text: result.text,
      tokensIn: tokensIn || null,
      tokensOut: tokensOut || null,
      latencyMs: 0,
      model: this.model,
      tokenDetails,
      cost: costBreakdown?.total ?? null,
    };
  }

  /**
   * Streaming LLM call via AI SDK `streamText`.
   */
  protected override async doCallWithStreaming(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    callbacks: StreamCallbacks
  ): Promise<LLMResponse> {
    const { streamText } = await import('ai');
    const model = await this.resolveModel();

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: maxTokens,
      ...(this.supportsTemperature ? { temperature: this.temperature } : {}),
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      callbacks.onToken?.(chunk);
    }

    // Await the usage promise for token counts
    const usage = await result.usage;
    const tokensIn = usage?.inputTokens ?? 0;
    const tokensOut = usage?.outputTokens ?? 0;

    // Extract detailed token breakdown from AI SDK
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usageAny = usage as any;
    const tokenDetails = {
      cacheReadTokens: usageAny?.inputTokenDetails?.cacheReadTokens ?? undefined,
      cacheWriteTokens: usageAny?.inputTokenDetails?.cacheWriteTokens ?? undefined,
      reasoningTokens: usageAny?.outputTokenDetails?.reasoningTokens ?? undefined,
    };

    const costBreakdown = calculateCost(this.model, tokensIn, tokensOut, tokenDetails);

    return {
      text: fullText,
      tokensIn: tokensIn || null,
      tokensOut: tokensOut || null,
      latencyMs: 0,
      model: this.model,
      tokenDetails,
      cost: costBreakdown?.total ?? null,
    };
  }
}
