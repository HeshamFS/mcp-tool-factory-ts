/**
 * OpenAI provider implementation.
 */

import { BaseLLMProvider, type LLMResponse, type ProviderOptions } from './base.js';

/**
 * Provider for OpenAI's GPT models.
 */
export class OpenAIProvider extends BaseLLMProvider {
  private openaiClient: unknown = null;

  constructor(options: ProviderOptions) {
    super(options);
  }

  protected async initializeClient(): Promise<void> {
    // Dynamic import to make the dependency optional
    const OpenAI = await import('openai').then((m) => m.default);
    this.openaiClient = new OpenAI({ apiKey: this.apiKey });
    this.client = this.openaiClient;
  }

  protected async callApi(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    const client = this.openaiClient as {
      chat: {
        completions: {
          create: (params: Record<string, unknown>) => Promise<{
            id?: string;
            model?: string;
            created?: number;
            choices: Array<{
              message: { content: string | null };
              finish_reason?: string;
            }>;
            usage?: {
              prompt_tokens: number;
              completion_tokens: number;
            };
          }>;
        };
      };
    };

    // Handle newer models that use max_completion_tokens
    const isNewModel =
      this.model.startsWith('gpt-5') ||
      this.model.startsWith('gpt-4.1') ||
      this.model.startsWith('o3') ||
      this.model.startsWith('o4');

    const tokenParam = isNewModel ? 'max_completion_tokens' : 'max_tokens';

    const response = await client.chat.completions.create({
      model: this.model,
      [tokenParam]: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const text = response.choices[0]?.message.content ?? '';
    const tokensIn = response.usage?.prompt_tokens ?? null;
    const tokensOut = response.usage?.completion_tokens ?? null;

    // Build raw response for logging
    let rawResponse: Record<string, unknown> | null = null;
    try {
      rawResponse = {
        id: response.id,
        model: response.model,
        created: response.created,
        usage: {
          prompt_tokens: tokensIn,
          completion_tokens: tokensOut,
          total_tokens: (tokensIn ?? 0) + (tokensOut ?? 0),
        },
        choices: [
          {
            message: { role: 'assistant', content: text },
            finish_reason: response.choices[0]?.finish_reason,
          },
        ],
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
