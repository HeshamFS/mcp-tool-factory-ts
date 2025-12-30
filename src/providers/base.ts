/**
 * Base LLM Provider interface.
 */

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
}

/**
 * Create an error LLM response.
 */
export function createErrorResponse(
  error: Error | string,
  latencyMs: number
): LLMResponse {
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
  /** Additional provider-specific options */
  [key: string]: unknown;
}

/**
 * Abstract base class for LLM providers.
 *
 * All provider implementations must extend this class and implement
 * the required methods.
 */
export abstract class BaseLLMProvider {
  protected apiKey: string;
  protected model: string;
  protected temperature: number;
  protected client: unknown = null;

  constructor(options: ProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.temperature = options.temperature ?? 0.7;
  }

  /**
   * Initialize the provider-specific client.
   */
  protected abstract initializeClient(): Promise<void>;

  /**
   * Make the actual API call to the provider.
   */
  protected abstract callApi(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse>;

  /**
   * Call the LLM with timing and error handling.
   */
  async call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 4096
  ): Promise<LLMResponse> {
    const startTime = performance.now();

    try {
      if (this.client === null) {
        await this.initializeClient();
      }

      const response = await this.callApi(systemPrompt, userPrompt, maxTokens);
      response.latencyMs = performance.now() - startTime;
      return response;
    } catch (e) {
      return createErrorResponse(
        e instanceof Error ? e : new Error(String(e)),
        performance.now() - startTime
      );
    }
  }

  /**
   * Return the provider name for logging.
   */
  get providerName(): string {
    return this.constructor.name.replace('Provider', '');
  }
}
