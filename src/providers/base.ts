/**
 * Base LLM Provider interfaces and caching wrapper.
 */

import { LLMCache, type CacheConfig, type CacheStats } from '../cache/index.js';

/**
 * Structured response from an LLM provider.
 */
export interface LLMResponse {
  /** Generated text content */
  text: string;
  /** Number of input tokens */
  tokensIn?: number | null;
  /** Number of output tokens */
  tokensOut?: number | null;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** Model used for generation */
  model?: string | null;
  /** Raw response from the API */
  rawResponse?: Record<string, unknown> | null;
  /** Error message if the call failed */
  error?: string | null;
  /** Error stack trace */
  errorStack?: string | null;
  /** Whether this response was served from cache */
  fromCache?: boolean;
  /** Detailed token breakdown from AI SDK */
  tokenDetails?: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
  } | null;
  /** Estimated cost in USD for this call */
  cost?: number | null;
}

/**
 * Create an error LLM response.
 */
export function createErrorResponse(error: Error | string, latencyMs: number): LLMResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorStack = error instanceof Error ? error.stack : undefined;

  return {
    text: '',
    latencyMs,
    error: errorMessage,
    errorStack,
  };
}

/**
 * Options for provider initialization.
 */
export interface ProviderOptions {
  /** API key for the provider */
  apiKey: string;
  /** Model identifier to use */
  model: string;
  /** Sampling temperature (0-1) */
  temperature?: number;
  /** Cache configuration (pass false to disable) */
  cache?: Partial<CacheConfig> | false;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

/**
 * Callbacks for streaming responses.
 */
export interface StreamCallbacks {
  /** Called for each token/chunk received */
  onToken?: (token: string) => void;
  /** Called when the stream completes */
  onComplete?: (response: LLMResponse) => void;
  /** Called if an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Public interface for LLM providers.
 *
 * Both the unified AI SDK provider and legacy ClaudeCode provider implement this.
 */
export interface LLMProviderInterface {
  call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number,
    options?: { skipCache?: boolean }
  ): Promise<LLMResponse>;

  callWithStreaming(
    systemPrompt: string,
    userPrompt: string,
    maxTokens?: number,
    callbacks?: StreamCallbacks,
    options?: { skipCache?: boolean }
  ): Promise<LLMResponse>;

  readonly providerName: string;
  readonly supportsStreaming: boolean;

  getCacheStats(): CacheStats | null;
  clearCache(): void;
}

/**
 * Base class providing caching, timing, and error handling for LLM providers.
 *
 * Subclasses implement `doCall()` and optionally `doCallWithStreaming()`.
 */
export abstract class BaseCachingProvider implements LLMProviderInterface {
  protected apiKey: string;
  protected model: string;
  protected temperature: number;
  protected cache: LLMCache | null = null;

  constructor(options: ProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.temperature = options.temperature ?? 0.7;

    // Initialize cache unless explicitly disabled
    if (options.cache !== false) {
      this.cache = new LLMCache(options.cache ?? {});
    }
  }

  /**
   * Make the actual API call. Subclasses must implement this.
   */
  protected abstract doCall(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse>;

  /**
   * Stream the API response. Override in subclasses that support streaming.
   */
  protected async doCallWithStreaming(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    _callbacks: StreamCallbacks
  ): Promise<LLMResponse> {
    // Default: fall back to non-streaming
    return this.doCall(systemPrompt, userPrompt, maxTokens);
  }

  /**
   * Call the LLM with caching, timing, and error handling.
   */
  async call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 4096,
    options?: { skipCache?: boolean }
  ): Promise<LLMResponse> {
    const startTime = performance.now();
    const { skipCache = false } = options ?? {};

    const cacheKeyParams = {
      systemPrompt,
      userPrompt,
      maxTokens,
      model: this.model,
      temperature: this.temperature,
    };

    // Try cache
    if (this.cache && !skipCache) {
      const cached = this.cache.get(cacheKeyParams);
      if (cached) {
        return {
          text: cached.text,
          tokensIn: cached.tokensIn,
          tokensOut: cached.tokensOut,
          model: cached.model,
          latencyMs: performance.now() - startTime,
          fromCache: true,
        };
      }
    }

    try {
      const response = await this.doCall(systemPrompt, userPrompt, maxTokens);
      response.latencyMs = performance.now() - startTime;
      response.fromCache = false;

      // Store in cache if successful
      if (this.cache && !response.error) {
        this.cache.set(cacheKeyParams, response.text, {
          tokensIn: response.tokensIn,
          tokensOut: response.tokensOut,
          model: response.model,
        });
      }

      return response;
    } catch (e) {
      return createErrorResponse(
        e instanceof Error ? e : new Error(String(e)),
        performance.now() - startTime
      );
    }
  }

  /**
   * Call the LLM with streaming support, caching, timing, and error handling.
   */
  async callWithStreaming(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 4096,
    callbacks?: StreamCallbacks,
    options?: { skipCache?: boolean }
  ): Promise<LLMResponse> {
    const startTime = performance.now();
    const { skipCache = false } = options ?? {};
    const cbs = callbacks ?? {};

    const cacheKeyParams = {
      systemPrompt,
      userPrompt,
      maxTokens,
      model: this.model,
      temperature: this.temperature,
    };

    // Try cache
    if (this.cache && !skipCache) {
      const cached = this.cache.get(cacheKeyParams);
      if (cached) {
        const response: LLMResponse = {
          text: cached.text,
          tokensIn: cached.tokensIn,
          tokensOut: cached.tokensOut,
          model: cached.model,
          latencyMs: performance.now() - startTime,
          fromCache: true,
        };
        cbs.onToken?.(cached.text);
        cbs.onComplete?.(response);
        return response;
      }
    }

    try {
      let response: LLMResponse;

      if (this.supportsStreaming) {
        response = await this.doCallWithStreaming(systemPrompt, userPrompt, maxTokens, cbs);
      } else {
        response = await this.doCall(systemPrompt, userPrompt, maxTokens);
        cbs.onToken?.(response.text);
      }

      response.latencyMs = performance.now() - startTime;
      response.fromCache = false;

      // Store in cache if successful
      if (this.cache && !response.error) {
        this.cache.set(cacheKeyParams, response.text, {
          tokensIn: response.tokensIn,
          tokensOut: response.tokensOut,
          model: response.model,
        });
      }

      cbs.onComplete?.(response);
      return response;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      cbs.onError?.(error);
      return createErrorResponse(error, performance.now() - startTime);
    }
  }

  get providerName(): string {
    return this.constructor.name.replace('Provider', '');
  }

  get supportsStreaming(): boolean {
    return false;
  }

  getCacheStats(): CacheStats | null {
    return this.cache?.getStats() ?? null;
  }

  clearCache(): void {
    this.cache?.clear();
  }

  get cachingEnabled(): boolean {
    return this.cache?.enabled ?? false;
  }
}

/**
 * @deprecated Use `BaseCachingProvider` instead. Kept as alias for backward compatibility.
 */
export abstract class BaseLLMProvider extends BaseCachingProvider {
  protected client: unknown = null;

  protected abstract initializeClient(): Promise<void>;

  protected abstract callApi(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse>;

  protected override async doCall(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    if (this.client === null) {
      await this.initializeClient();
    }
    return this.callApi(systemPrompt, userPrompt, maxTokens);
  }

  protected async callApiWithStreaming(
    _systemPrompt: string,
    _userPrompt: string,
    _maxTokens: number,
    _callbacks: StreamCallbacks
  ): Promise<LLMResponse> {
    throw new Error('Streaming not supported by this provider');
  }

  protected override async doCallWithStreaming(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    callbacks: StreamCallbacks
  ): Promise<LLMResponse> {
    if (this.client === null) {
      await this.initializeClient();
    }
    return this.callApiWithStreaming(systemPrompt, userPrompt, maxTokens, callbacks);
  }
}
