/**
 * Full raw execution logger that captures EVERYTHING - no truncation, no summaries.
 *
 * This logger captures the COMPLETE raw execution trace:
 * - FULL raw prompts sent to LLMs (no truncation)
 * - FULL raw responses received (no truncation)
 * - FULL HTTP request data (method, url, headers, body)
 * - FULL HTTP response data (status, headers, body)
 * - FULL web search queries and results
 * - FULL tool execution inputs and outputs
 * - All timing and metadata
 */

/**
 * Complete record of an LLM API call - FULL DATA.
 */
export interface RawLLMCall {
  timestamp: string;
  provider: string;
  model: string;

  // FULL request data
  systemPrompt: string;
  userPrompt: string;
  requestParams: Record<string, unknown>;

  // FULL response data
  rawResponse: string;
  responseObject?: Record<string, unknown>;

  // Token counts
  tokensIn?: number;
  tokensOut?: number;

  // Timing
  latencyMs: number;

  // Error if any
  error?: string;
  errorTraceback?: string;
}

/**
 * Complete record of an HTTP request - FULL DATA.
 */
export interface RawHTTPRequest {
  timestamp: string;

  // FULL request data
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;

  // FULL response data
  statusCode?: number;
  responseHeaders: Record<string, string>;
  responseBody: string;

  // Timing
  latencyMs: number;

  // Error if any
  error?: string;
}

/**
 * Complete record of a web search - FULL DATA.
 */
export interface RawWebSearch {
  timestamp: string;
  provider: string;

  // Search query
  query: string;

  // FULL raw search results
  rawResults: string;
  sources: Array<Record<string, unknown>>;

  // API call details
  apiRequest: Record<string, unknown>;
  apiResponse: Record<string, unknown>;

  // Timing
  latencyMs: number;

  // Error if any
  error?: string;
}

/**
 * Complete record of a tool execution - FULL DATA.
 */
export interface RawToolExecution {
  timestamp: string;
  toolName: string;

  // FULL input/output
  inputArgs: Record<string, unknown>;
  outputResult: unknown;

  // Timing
  latencyMs: number;

  // Error if any
  error?: string;
}

/**
 * A single step in the execution.
 */
export interface ExecutionStep {
  timestamp: string;
  stepType: string;
  description: string;
  rawData: Record<string, unknown>;
}

/**
 * Logger that captures FULL raw execution trace data - NO TRUNCATION.
 */
export class ExecutionLogger {
  serverName: string;
  provider: string;
  model: string;
  startTime: Date;
  originalDescription: string;
  webSearchEnabled: boolean;

  // FULL raw execution data - no truncation
  llmCalls: RawLLMCall[];
  httpRequests: RawHTTPRequest[];
  webSearches: RawWebSearch[];
  toolExecutions: RawToolExecution[];
  steps: ExecutionStep[];

  // Summary counters
  toolsGenerated: string[];
  totalTokensIn: number;
  totalTokensOut: number;

  constructor(serverName: string, provider: string, model: string) {
    this.serverName = serverName;
    this.provider = provider;
    this.model = model;
    this.startTime = new Date();
    this.originalDescription = '';
    this.webSearchEnabled = false;

    this.llmCalls = [];
    this.httpRequests = [];
    this.webSearches = [];
    this.toolExecutions = [];
    this.steps = [];

    this.toolsGenerated = [];
    this.totalTokensIn = 0;
    this.totalTokensOut = 0;
  }

  /**
   * Log an execution step with full raw data.
   */
  logStep(stepType: string, description: string, rawData: Record<string, unknown> = {}): void {
    this.steps.push({
      timestamp: new Date().toISOString(),
      stepType,
      description,
      rawData,
    });
  }

  /**
   * Log a FULL LLM API call with complete request/response data.
   */
  logLlmCall(params: {
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    requestParams?: Record<string, unknown>;
    responseObject?: Record<string, unknown>;
    tokensIn?: number;
    tokensOut?: number;
    latencyMs?: number;
    error?: string;
    errorTraceback?: string;
  }): void {
    const call: RawLLMCall = {
      timestamp: new Date().toISOString(),
      provider: this.provider,
      model: this.model,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      requestParams: params.requestParams ?? {},
      rawResponse: params.rawResponse,
      responseObject: params.responseObject,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      latencyMs: params.latencyMs ?? 0,
      error: params.error,
      errorTraceback: params.errorTraceback,
    };
    this.llmCalls.push(call);

    if (params.tokensIn) {
      this.totalTokensIn += params.tokensIn;
    }
    if (params.tokensOut) {
      this.totalTokensOut += params.tokensOut;
    }
  }

  /**
   * Log a FULL HTTP request with complete headers and body.
   */
  logHttpRequest(params: {
    method: string;
    url: string;
    requestHeaders?: Record<string, string>;
    requestBody?: string;
    statusCode?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    latencyMs?: number;
    error?: string;
  }): void {
    this.httpRequests.push({
      timestamp: new Date().toISOString(),
      method: params.method,
      url: params.url,
      requestHeaders: params.requestHeaders ?? {},
      requestBody: params.requestBody ?? '',
      statusCode: params.statusCode,
      responseHeaders: params.responseHeaders ?? {},
      responseBody: params.responseBody ?? '',
      latencyMs: params.latencyMs ?? 0,
      error: params.error,
    });
  }

  /**
   * Log a FULL web search with complete results.
   */
  logWebSearch(params: {
    provider: string;
    query: string;
    rawResults: string;
    sources?: Array<Record<string, unknown>>;
    apiRequest?: Record<string, unknown>;
    apiResponse?: Record<string, unknown>;
    latencyMs?: number;
    error?: string;
  }): void {
    this.webSearches.push({
      timestamp: new Date().toISOString(),
      provider: params.provider,
      query: params.query,
      rawResults: params.rawResults,
      sources: params.sources ?? [],
      apiRequest: params.apiRequest ?? {},
      apiResponse: params.apiResponse ?? {},
      latencyMs: params.latencyMs ?? 0,
      error: params.error,
    });
  }

  /**
   * Log a tool execution with full input/output.
   */
  logToolExecution(params: {
    toolName: string;
    inputArgs: Record<string, unknown>;
    outputResult?: unknown;
    latencyMs?: number;
    error?: string;
  }): void {
    this.toolExecutions.push({
      timestamp: new Date().toISOString(),
      toolName: params.toolName,
      inputArgs: params.inputArgs,
      outputResult: params.outputResult,
      latencyMs: params.latencyMs ?? 0,
      error: params.error,
    });
  }

  /**
   * Generate FULL execution log as markdown - NO TRUNCATION.
   */
  toMarkdown(): string {
    const endTime = new Date();
    const duration = (endTime.getTime() - this.startTime.getTime()) / 1000;

    const lines: string[] = [
      `# FULL Execution Log: ${this.serverName}`,
      '',
      '**This log contains COMPLETE raw data - no truncation, no summaries.**',
      '',
      '## Execution Summary',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Started | \`${this.startTime.toISOString()}\` |`,
      `| Finished | \`${endTime.toISOString()}\` |`,
      `| Duration | \`${duration.toFixed(2)}s\` |`,
      `| Provider | \`${this.provider}\` |`,
      `| Model | \`${this.model}\` |`,
      `| Web Search | \`${this.webSearchEnabled}\` |`,
      `| LLM Calls | \`${this.llmCalls.length}\` |`,
      `| HTTP Requests | \`${this.httpRequests.length}\` |`,
      `| Web Searches | \`${this.webSearches.length}\` |`,
      `| Tool Executions | \`${this.toolExecutions.length}\` |`,
      `| Total Tokens In | \`${this.totalTokensIn}\` |`,
      `| Total Tokens Out | \`${this.totalTokensOut}\` |`,
      `| Tools Generated | \`${this.toolsGenerated.length}\` |`,
      '',
      '---',
      '',
      '## Original Request',
      '',
      '```',
      this.originalDescription,
      '```',
      '',
    ];

    // Web Searches
    if (this.webSearches.length > 0) {
      lines.push('---', '', '## Web Searches (FULL RAW DATA)', '');
      this.webSearches.forEach((search, i) => {
        lines.push(
          `### Web Search ${i + 1}`,
          '',
          `- **Timestamp:** \`${search.timestamp}\``,
          `- **Provider:** \`${search.provider}\``,
          `- **Query:** \`${search.query}\``,
          `- **Latency:** \`${search.latencyMs.toFixed(0)}ms\``
        );
        if (search.error) {
          lines.push(`- **Error:** \`${search.error}\``);
        }
        if (Object.keys(search.apiRequest).length > 0) {
          lines.push('', '#### API Request (RAW):', '', '```json', JSON.stringify(search.apiRequest, null, 2), '```');
        }
        if (Object.keys(search.apiResponse).length > 0) {
          lines.push('', '#### API Response (RAW):', '', '```json', JSON.stringify(search.apiResponse, null, 2), '```');
        }
        lines.push('', '#### Full Raw Results:', '', '```', search.rawResults, '```', '');
        if (search.sources.length > 0) {
          lines.push('#### Sources (FULL DATA):', '', '```json', JSON.stringify(search.sources, null, 2), '```', '');
        }
      });
    }

    // LLM Calls
    if (this.llmCalls.length > 0) {
      lines.push('---', '', '## LLM API Calls (FULL RAW DATA)', '');
      this.llmCalls.forEach((call, i) => {
        const tokensInfo = call.tokensIn || call.tokensOut
          ? ` | Tokens: ${call.tokensIn ?? '?'} in, ${call.tokensOut ?? '?'} out`
          : '';
        lines.push(
          `### LLM Call ${i + 1}: ${call.provider}/${call.model}`,
          '',
          `- **Timestamp:** \`${call.timestamp}\``,
          `- **Latency:** \`${call.latencyMs.toFixed(0)}ms\`${tokensInfo}`
        );
        if (call.error) {
          lines.push(`- **Error:** \`${call.error}\``);
          if (call.errorTraceback) {
            lines.push('', '#### Error Traceback:', '', '```', call.errorTraceback, '```');
          }
        }
        if (Object.keys(call.requestParams).length > 0) {
          lines.push('', '#### Request Parameters:', '', '```json', JSON.stringify(call.requestParams, null, 2), '```');
        }
        lines.push('', '#### System Prompt (FULL):', '', '```', call.systemPrompt, '```', '');
        lines.push('#### User Prompt (FULL):', '', '```', call.userPrompt, '```', '');
        lines.push('#### Raw Response (FULL):', '', '```', call.rawResponse, '```', '');
        if (call.responseObject) {
          lines.push('#### Full Response Object:', '', '```json', JSON.stringify(call.responseObject, null, 2), '```', '');
        }
      });
    }

    // Tools Generated
    if (this.toolsGenerated.length > 0) {
      lines.push('---', '', '## Tools Generated', '');
      this.toolsGenerated.forEach((tool) => {
        lines.push(`- \`${tool}\``);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export FULL execution data as JSON - NO TRUNCATION.
   */
  toJson(): string {
    const endTime = new Date();
    return JSON.stringify({
      metadata: {
        serverName: this.serverName,
        provider: this.provider,
        model: this.model,
        startTime: this.startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationSeconds: (endTime.getTime() - this.startTime.getTime()) / 1000,
        webSearchEnabled: this.webSearchEnabled,
        originalDescription: this.originalDescription,
      },
      summary: {
        totalLlmCalls: this.llmCalls.length,
        totalHttpRequests: this.httpRequests.length,
        totalWebSearches: this.webSearches.length,
        totalToolExecutions: this.toolExecutions.length,
        totalTokensIn: this.totalTokensIn,
        totalTokensOut: this.totalTokensOut,
        toolsGenerated: this.toolsGenerated,
      },
      llmCalls: this.llmCalls,
      httpRequests: this.httpRequests,
      webSearches: this.webSearches,
      toolExecutions: this.toolExecutions,
      steps: this.steps,
    }, null, 2);
  }
}

/**
 * Create a new execution logger.
 */
export function createExecutionLogger(
  serverName: string,
  provider: string,
  model: string
): ExecutionLogger {
  return new ExecutionLogger(serverName, provider, model);
}
