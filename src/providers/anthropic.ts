/**
 * Anthropic (Claude) provider implementation.
 */

import { BaseLLMProvider, type LLMResponse, type ProviderOptions } from './base.js';

/**
 * Provider for Anthropic's Claude models.
 */
export class AnthropicProvider extends BaseLLMProvider {
  private anthropicClient: unknown = null;

  constructor(options: ProviderOptions) {
    super(options);
  }

  protected async initializeClient(): Promise<void> {
    // Dynamic import to make the dependency optional
    const Anthropic = await import('@anthropic-ai/sdk').then((m) => m.default);
    this.anthropicClient = new Anthropic({ apiKey: this.apiKey });
    this.client = this.anthropicClient;
  }

  protected async callApi(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    const client = this.anthropicClient as {
      messages: {
        create: (params: {
          model: string;
          max_tokens: number;
          system: string;
          messages: Array<{ role: string; content: string }>;
        }) => Promise<{
          id?: string;
          type?: string;
          role?: string;
          model?: string;
          stop_reason?: string;
          content: Array<{ text: string }>;
          usage?: {
            input_tokens: number;
            output_tokens: number;
          };
        }>;
      };
    };

    const response = await client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.text ?? '';
    const tokensIn = response.usage?.input_tokens ?? null;
    const tokensOut = response.usage?.output_tokens ?? null;

    // Build raw response for logging
    let rawResponse: Record<string, unknown> | null = null;
    try {
      rawResponse = {
        id: response.id,
        type: response.type,
        role: response.role,
        model: response.model,
        stop_reason: response.stop_reason,
        usage: {
          input_tokens: tokensIn,
          output_tokens: tokensOut,
        },
        content: [{ type: 'text', text }],
      };
    } catch {
      // Ignore logging errors
    }

    return {
      text,
      tokensIn,
      tokensOut,
      latencyMs: 0, // Will be set by the caller
      model: this.model,
      rawResponse,
    };
  }
}
