/**
 * Web search capabilities for each LLM provider - captures FULL raw data.
 *
 * Each provider has its own web search tool:
 * - Anthropic: web_search_20250305 tool ($10/1k searches)
 * - OpenAI: web_search tool with search-enabled models
 * - Google: google_search grounding tool ($14/1k queries)
 *
 * References:
 * - https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search-tool
 * - https://platform.openai.com/docs/guides/tools-web-search
 * - https://ai.google.dev/gemini-api/docs/google-search
 */

import { LLMProvider } from '../config/index.js';
import type { ExecutionLogger } from '../execution-logger/index.js';

/**
 * Result from a web search - FULL DATA.
 */
export interface SearchResult {
  query: string;
  content: string; // Full content - no truncation
  sources: Array<Record<string, unknown>>; // Full source data
  rawApiRequest: Record<string, unknown>;
  rawApiResponse: Record<string, unknown>;
}

/**
 * Create a search result.
 */
export function createSearchResult(
  query: string,
  content: string,
  sources: Array<Record<string, unknown>> = [],
  rawApiRequest: Record<string, unknown> = {},
  rawApiResponse: Record<string, unknown> = {}
): SearchResult {
  return {
    query,
    content,
    sources,
    rawApiRequest,
    rawApiResponse,
  };
}

/**
 * Web search handler for different LLM providers - captures FULL raw data.
 */
export class WebSearcher {
  provider: LLMProvider;
  apiKey: string;
  model: string | undefined;

  constructor(provider: LLMProvider, apiKey: string, model?: string) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model;
  }

  /**
   * Perform a web search using the provider's native tool.
   */
  async search(query: string, maxResults: number = 5): Promise<SearchResult> {
    switch (this.provider) {
      case LLMProvider.ANTHROPIC:
        return this.searchAnthropic(query, maxResults);
      case LLMProvider.CLAUDE_CODE:
        return this.searchClaudeCode(query, maxResults);
      case LLMProvider.OPENAI:
        return this.searchOpenAI(query, maxResults);
      case LLMProvider.GOOGLE:
        return this.searchGoogle(query, maxResults);
      default:
        throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  /**
   * Search using Anthropic's web_search tool - captures FULL data.
   * @see https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
   */
  private async searchAnthropic(query: string, maxResults: number): Promise<SearchResult> {
    // Dynamic import to avoid requiring the SDK if not used
    const { default: Anthropic } = await import('@anthropic-ai/sdk');

    const client = new Anthropic({ apiKey: this.apiKey });

    // Build request - NO beta header needed, just the tool type
    const apiRequest = {
      model: this.model ?? 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
          max_uses: maxResults,
        },
      ],
      messages: [
        {
          role: 'user' as const,
          content:
            `Search the web for: ${query}\n\n` +
            'Provide a comprehensive summary of the most relevant information found.',
        },
      ],
    };

    const response = await client.messages.create({
      model: apiRequest.model,
      max_tokens: apiRequest.max_tokens,
      tools: apiRequest.tools as any,
      messages: apiRequest.messages,
    });

    // Extract FULL content and sources from all block types
    let content = '';
    const sources: Array<Record<string, unknown>> = [];
    const rawContentBlocks: Array<Record<string, unknown>> = [];

    for (const block of response.content) {
      const blockType = (block as any).type ?? 'unknown';
      const blockData: Record<string, unknown> = { type: blockType };

      // Handle text blocks with optional citations
      if (blockType === 'text' && 'text' in block) {
        content += (block as any).text;
        blockData.text = (block as any).text;

        // Extract citations from text blocks
        if ('citations' in block && Array.isArray((block as any).citations)) {
          const blockCitations: Array<Record<string, unknown>> = [];
          for (const citation of (block as any).citations) {
            const sourceData: Record<string, unknown> = {};
            if (citation.url) sourceData.url = citation.url;
            if (citation.title) sourceData.title = citation.title;
            if (citation.cited_text) sourceData.cited_text = citation.cited_text;
            blockCitations.push(sourceData);
            // Add to global sources if not already present
            if (citation.url && !sources.some((s) => s.url === citation.url)) {
              sources.push(sourceData);
            }
          }
          blockData.citations = blockCitations;
        }
      }

      // Handle server_tool_use blocks (search queries)
      if (blockType === 'server_tool_use') {
        blockData.name = (block as any).name;
        blockData.input = (block as any).input;
      }

      // Handle web_search_tool_result blocks (search results)
      if (blockType === 'web_search_tool_result') {
        const resultContent = (block as any).content;
        if (Array.isArray(resultContent)) {
          const searchResults: Array<Record<string, unknown>> = [];
          for (const result of resultContent) {
            if (result.type === 'web_search_result') {
              const resultData: Record<string, unknown> = {
                url: result.url,
                title: result.title,
                page_age: result.page_age,
              };
              searchResults.push(resultData);
              // Add to global sources
              if (!sources.some((s) => s.url === result.url)) {
                sources.push({ url: result.url, title: result.title });
              }
            }
          }
          blockData.results = searchResults;
          blockData.results_count = searchResults.length;
        }
      }

      rawContentBlocks.push(blockData);
    }

    // Build full response object
    const apiResponse = {
      id: response.id ?? null,
      type: response.type ?? null,
      role: response.role ?? null,
      model: response.model ?? null,
      stop_reason: response.stop_reason ?? null,
      content_blocks_count: rawContentBlocks.length,
      content: rawContentBlocks,
      usage: {
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        web_search_requests: (response.usage as any)?.server_tool_use?.web_search_requests ?? null,
      },
    };

    return createSearchResult(query, content, sources, apiRequest, apiResponse);
  }

  /**
   * Search using Claude Code SDK - captures FULL data.
   */
  private async searchClaudeCode(query: string, _maxResults: number): Promise<SearchResult> {
    // Claude Code SDK search - requires claude-agent-sdk
    const apiRequest = {
      max_turns: 1,
      system_prompt:
        'You are a research assistant. Search the web and provide ' +
        'factual information with sources.',
      prompt: `Search the web for information about: ${query}`,
    };

    try {
      // Dynamic import for Claude Agent SDK
      // Use variable to prevent TypeScript from resolving the module at build time
      const sdkModule = 'claude-agent-sdk';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const claudeSdk: any = await import(sdkModule);
      const { query: sdkQuery, ClaudeAgentOptions } = claudeSdk;

      const options = new ClaudeAgentOptions({
        maxTurns: 1,
        systemPrompt: apiRequest.system_prompt,
      });

      let result = '';
      const rawMessages: Array<Record<string, unknown>> = [];

      for await (const message of sdkQuery(apiRequest.prompt, options)) {
        const msgData: Record<string, unknown> = { type: message.constructor.name };

        if (message.content) {
          if (Array.isArray(message.content)) {
            msgData.content = [];
            for (const block of message.content) {
              if ('text' in block) {
                result += block.text;
                (msgData.content as Array<Record<string, unknown>>).push({
                  type: 'text',
                  text: block.text,
                });
              }
            }
          } else if (typeof message.content === 'string') {
            result += message.content;
            msgData.content = message.content;
          }
        }

        rawMessages.push(msgData);
      }

      return createSearchResult(query, result, [], apiRequest, { messages: rawMessages });
    } catch {
      // Fallback if claude-agent-sdk not available
      return createSearchResult(
        query,
        'Claude Agent SDK not available for web search',
        [],
        apiRequest,
        { error: 'claude-agent-sdk not installed' }
      );
    }
  }

  /**
   * Search using OpenAI's web_search tool - captures FULL data.
   */
  private async searchOpenAI(query: string, _maxResults: number): Promise<SearchResult> {
    // Dynamic import to avoid requiring the SDK if not used
    const { default: OpenAI } = await import('openai');

    const client = new OpenAI({ apiKey: this.apiKey });

    const apiRequest = {
      model: this.model ?? 'gpt-5.2',
      tools: [
        {
          type: 'web_search',
          search_context_size: 'medium',
        },
      ],
      input: `Search the web for: ${query}\n\nProvide a comprehensive summary.`,
    };

    // Use responses API for web search
    const response = await (client as any).responses.create({
      model: apiRequest.model,
      tools: apiRequest.tools,
      input: apiRequest.input,
    });

    const content = response.output_text ?? String(response);
    const sources: Array<Record<string, unknown>> = [];

    // Extract FULL citations
    if (response.citations) {
      for (const c of response.citations) {
        const sourceData: Record<string, unknown> = {};
        if (c.url) sourceData.url = c.url;
        if (c.title) sourceData.title = c.title;
        if (c.snippet) sourceData.snippet = c.snippet;
        sources.push(sourceData);
      }
    }

    // Build full response object
    const apiResponse: Record<string, unknown> = {
      output_text: content,
      citations: sources,
    };

    // Add any other response attributes
    for (const attr of ['id', 'model', 'created', 'status']) {
      if (attr in response) {
        apiResponse[attr] = response[attr];
      }
    }

    return createSearchResult(query, content, sources, apiRequest, apiResponse);
  }

  /**
   * Search using Google's grounding with Google Search - captures FULL data.
   */
  private async searchGoogle(query: string, _maxResults: number): Promise<SearchResult> {
    // Dynamic import to avoid requiring the SDK if not used
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const genAI = new GoogleGenerativeAI(this.apiKey);

    const apiRequest = {
      model_name: this.model ?? 'gemini-2.0-flash',
      tools: [{ google_search: {} }],
      prompt:
        `Search the web for: ${query}\n\n` + 'Provide a comprehensive summary with sources.',
    };

    const model = genAI.getGenerativeModel({
      model: apiRequest.model_name,
      tools: apiRequest.tools as any,
    });

    const response = await model.generateContent(apiRequest.prompt);

    const content = response.response.text() ?? String(response);
    const sources: Array<Record<string, unknown>> = [];
    let apiResponseGrounding: Record<string, unknown> | null = null;

    // Extract grounding metadata from candidates
    const candidates = response.response.candidates;
    if (candidates && candidates.length > 0) {
      const candidate = candidates[0]!;
      const grounding = (candidate as any).groundingMetadata;

      if (grounding) {
        apiResponseGrounding = {};

        // Extract grounding_chunks (web sources with URI and title)
        if (grounding.groundingChunks) {
          for (const chunk of grounding.groundingChunks) {
            if (chunk.web) {
              const sourceData: Record<string, unknown> = {};
              if (chunk.web.uri) sourceData.url = chunk.web.uri;
              if (chunk.web.title) sourceData.title = chunk.web.title;
              sources.push(sourceData);
            }
          }
          apiResponseGrounding.grounding_chunks = String(grounding.groundingChunks);
        }

        // Extract search queries used
        if (grounding.webSearchQueries) {
          apiResponseGrounding.web_search_queries = Array.from(grounding.webSearchQueries);
        }

        // Extract grounding supports (citations)
        if (grounding.groundingSupports) {
          apiResponseGrounding.grounding_supports = String(grounding.groundingSupports);
        }
      }
    }

    // Build full response object
    const apiResponse: Record<string, unknown> = {
      text: content,
      grounding_metadata: apiResponseGrounding,
    };

    // Add candidates info if available
    if (candidates) {
      try {
        apiResponse.candidates_count = candidates.length;
      } catch {
        // Ignore
      }
    }

    return createSearchResult(query, content, sources, apiRequest, apiResponse);
  }
}

/**
 * Generate relevant search queries from a description.
 */
function generateSearchQueries(description: string): string[] {
  const queries: string[] = [];
  const descLower = description.toLowerCase();

  // Look for common patterns
  if (descLower.includes('weather')) {
    queries.push('free weather API documentation examples');
  }
  if (descLower.includes('stock') || descLower.includes('finance')) {
    queries.push('free stock price API documentation');
  }
  if (descLower.includes('geocod') || descLower.includes('location')) {
    queries.push('geocoding API documentation examples');
  }
  if (descLower.includes('database')) {
    queries.push('database connection TypeScript examples');
  }
  if (descLower.includes('email')) {
    queries.push('email sending API TypeScript examples');
  }
  if (descLower.includes('file')) {
    queries.push('file operations TypeScript best practices');
  }

  // Add a general query based on description
  queries.push(`${description.slice(0, 100)} API documentation TypeScript`);

  return queries;
}

/**
 * Search for API documentation and implementation details.
 *
 * @param description - The tool description to search for
 * @param provider - LLM provider to use for search
 * @param apiKey - API key for the provider
 * @param model - Optional model override
 * @returns String with relevant API information and examples
 */
export async function searchForApiInfo(
  description: string,
  provider: LLMProvider,
  apiKey: string,
  model?: string
): Promise<string> {
  const searcher = new WebSearcher(provider, apiKey, model);

  // Generate search queries based on description
  const queries = generateSearchQueries(description);

  const results: string[] = [];
  for (const query of queries.slice(0, 3)) {
    // Limit to 3 searches
    try {
      const result = await searcher.search(query);
      results.push(`## ${query}\n\n${result.content}`);
      if (result.sources.length > 0) {
        const sourceUrls = result.sources
          .slice(0, 3)
          .map((s) => (s.url as string) ?? String(s));
        results.push('Sources: ' + sourceUrls.join(', '));
      }
    } catch (e) {
      results.push(`Search failed for '${query}': ${e}`);
    }
  }

  return results.join('\n\n');
}

/**
 * Search for API documentation with FULL execution logging.
 *
 * @param description - The tool description to search for
 * @param provider - LLM provider to use for search
 * @param apiKey - API key for the provider
 * @param model - Optional model override
 * @param logger - ExecutionLogger to record FULL raw data
 * @returns String with relevant API information and examples
 */
export async function searchForApiInfoWithLogging(
  description: string,
  provider: LLMProvider,
  apiKey: string,
  model?: string,
  logger?: ExecutionLogger
): Promise<string> {
  const searcher = new WebSearcher(provider, apiKey, model);
  const queries = generateSearchQueries(description);

  const results: string[] = [];
  for (const query of queries.slice(0, 3)) {
    const startTime = Date.now();
    try {
      const result = await searcher.search(query);
      const latencyMs = Date.now() - startTime;

      // Log the FULL web search with complete raw data
      if (logger) {
        logger.logWebSearch({
          provider: provider,
          query: query,
          rawResults: result.content, // FULL - no truncation
          sources: result.sources, // FULL source data
          apiRequest: result.rawApiRequest,
          apiResponse: result.rawApiResponse,
          latencyMs: latencyMs,
        });
      }

      results.push(`## ${query}\n\n${result.content}`);
      if (result.sources.length > 0) {
        const sourceUrls = result.sources
          .slice(0, 3)
          .map((s) => (s.url as string) ?? String(s));
        results.push('Sources: ' + sourceUrls.join(', '));
      }
    } catch (e) {
      const latencyMs = Date.now() - startTime;
      if (logger) {
        logger.logWebSearch({
          provider: provider,
          query: query,
          rawResults: '',
          error: String(e),
          latencyMs: latencyMs,
        });
      }
      results.push(`Search failed for '${query}': ${e}`);
    }
  }

  return results.join('\n\n');
}
