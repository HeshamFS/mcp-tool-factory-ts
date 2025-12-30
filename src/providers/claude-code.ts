/**
 * Claude Code (Claude Agent SDK) provider implementation.
 */

import { BaseLLMProvider, type LLMResponse, type ProviderOptions } from './base.js';

/**
 * Provider for Claude using the Claude Agent SDK.
 *
 * The Claude Agent SDK (formerly Claude Code SDK) is designed for agentic workflows.
 * We configure it for raw text generation by:
 * - Disabling all tools (allowedTools=[])
 * - Limiting to single turn (maxTurns=1)
 * - Using custom systemPrompt
 */
export class ClaudeCodeProvider extends BaseLLMProvider {
  private initialized = false;

  /**
   * Initialize the Claude Agent SDK environment.
   */
  protected async initializeClient(): Promise<void> {
    // SDK reads CLAUDE_CODE_OAUTH_TOKEN from environment
    process.env.CLAUDE_CODE_OAUTH_TOKEN = this.apiKey;
    this.initialized = true;
    this.client = true; // Just a flag that we're initialized
  }

  /**
   * Make API call using Claude Agent SDK.
   */
  protected async callApi(
    systemPrompt: string,
    userPrompt: string,
    _maxTokens: number
  ): Promise<LLMResponse> {
    const text = await this.asyncQuery(systemPrompt, userPrompt);

    return {
      text,
      tokensIn: null, // SDK doesn't expose token counts
      tokensOut: null,
      latencyMs: 0, // Will be set by the base class
      model: 'claude-agent-sdk',
      rawResponse: null,
    };
  }

  /**
   * Async query using Claude Agent SDK.
   */
  private async asyncQuery(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      // Dynamic import for Claude Agent SDK
      // Use variable to prevent TypeScript from resolving the module at build time
      const sdkModule = '@anthropic-ai/claude-agent-sdk';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { query }: any = await import(sdkModule);

      let resultText = '';

      // The query function accepts { prompt, options } where options can include systemPrompt
      for await (const message of query({
        prompt: userPrompt,
        options: {
          maxTurns: 1,
          allowedTools: [], // No tools, just text generation
          systemPrompt: systemPrompt,
        },
      })) {
        // Handle 'result' type message (final response)
        if (message.type === 'result' && message.result) {
          resultText = message.result;
          break;
        }

        // Handle 'assistant' type message with nested content
        if (message.type === 'assistant' && message.message?.content) {
          const content = message.message.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && typeof block.text === 'string') {
                resultText += block.text;
              }
            }
          }
        }
      }

      return resultText;
    } catch (error) {
      // If @anthropic-ai/claude-agent-sdk is not available, throw a helpful error
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        throw new Error(
          'Claude Agent SDK (@anthropic-ai/claude-agent-sdk) is not installed. ' +
            'Install it with: npm install @anthropic-ai/claude-agent-sdk'
        );
      }
      throw error;
    }
  }

  /**
   * Return the provider name for logging.
   */
  get providerName(): string {
    return 'ClaudeCode';
  }
}
