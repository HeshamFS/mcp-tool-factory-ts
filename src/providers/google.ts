/**
 * Google (Gemini) provider implementation.
 */

import { BaseLLMProvider, type LLMResponse, type ProviderOptions } from './base.js';

/**
 * Provider for Google's Gemini models.
 */
export class GoogleProvider extends BaseLLMProvider {
  private geminiModel: unknown = null;

  constructor(options: ProviderOptions) {
    super(options);
  }

  protected async initializeClient(): Promise<void> {
    // Dynamic import to make the dependency optional
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(this.apiKey);
    this.geminiModel = genAI.getGenerativeModel({ model: this.model });
    this.client = this.geminiModel;
  }

  protected async callApi(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse> {
    const model = this.geminiModel as {
      generateContent: (
        prompt: string,
        options?: { generationConfig?: Record<string, unknown> }
      ) => Promise<{
        response: {
          text: () => string;
          candidates?: unknown[];
          promptFeedback?: unknown;
        };
      }>;
    };

    // Google combines system and user prompts
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const result = await model.generateContent(fullPrompt, {
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: this.temperature,
      },
    });

    const response = result.response;
    const text = response.text();

    // Build raw response for logging
    let rawResponse: Record<string, unknown> | null = null;
    try {
      rawResponse = {
        text,
        candidates: response.candidates ? String(response.candidates) : null,
        promptFeedback: response.promptFeedback ? String(response.promptFeedback) : null,
      };
    } catch {
      // Ignore logging errors
    }

    return {
      text,
      tokensIn: null, // Google doesn't expose token counts easily
      tokensOut: null,
      latencyMs: 0, // Will be set by the caller
      model: this.model,
      rawResponse,
    };
  }
}
