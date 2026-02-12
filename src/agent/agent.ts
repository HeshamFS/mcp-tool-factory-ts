/**
 * Main Tool Factory Agent for generating MCP servers.
 */

import type { FactoryConfig } from '../config/config.js';
import { getDefaultConfig, validateConfig, createFactoryConfig } from '../config/config.js';
import { LLMProvider } from '../config/providers.js';
import { formatCost } from '../config/pricing.js';
import type { LLMProviderInterface, LLMResponse } from '../providers/base.js';
import { createProvider } from '../providers/factory.js';
import type { ToolSpec, GeneratedServer, GenerationLog, ResourceSpec, PromptSpec } from '../models/index.js';
import {
  createToolSpec,
  createGeneratedServer,
  createGenerationLog,
  addStep,
  createResourceSpec,
  createPromptSpec,
} from '../models/index.js';
import { ServerGenerator, type ProductionConfig } from '../generators/server.js';
import { DocsGenerator } from '../generators/docs.js';
import { TestsGenerator } from '../generators/tests.js';
import {
  SYSTEM_PROMPT,
  EXTRACT_TOOLS_PROMPT,
  EXTRACT_RESOURCES_PROMPT,
  EXTRACT_PROMPTS_PROMPT,
  GENERATE_IMPLEMENTATION_PROMPT,
  formatPrompt,
} from '../prompts/prompts.js';
import {
  parseToolResponse,
  validateToolSpecs,
  extractCodeFromResponse,
} from '../validation/index.js';

/**
 * Options for generating a server.
 */
export interface GenerateOptions {
  /** Name for the generated server */
  serverName?: string;
  /** Description for the generated server */
  description?: string;
  /** GitHub username for MCP Registry publishing (creates io.github.<username>/<name>) */
  githubUsername?: string;
  /** Version for the generated server */
  version?: string;
  /** Enable web search for context */
  webSearch?: boolean;
  /** Environment variables for authentication */
  authEnvVars?: string[];
  /** Include health check endpoint */
  includeHealthCheck?: boolean;
  /** Production configuration */
  productionConfig?: ProductionConfig;
  /**
   * Enable parallel generation of tool implementations.
   * When true, all tool implementations are generated concurrently.
   * Default: true
   */
  parallel?: boolean;
  /**
   * Maximum number of concurrent LLM calls when parallel is enabled.
   * Set to 1 to disable parallelism. Default: 5
   */
  maxConcurrency?: number;
  /**
   * Skip the LLM cache for this generation.
   * Useful when you want fresh results. Default: false
   */
  skipCache?: boolean;
  /**
   * Enable streaming output from LLM calls.
   * When true, tokens are emitted as they arrive via onStreamToken callback.
   */
  stream?: boolean;
  /**
   * Callback for streaming tokens. Called for each token/chunk received.
   */
  onStreamToken?: (token: string) => void;
  /**
   * Maximum budget in USD. Generation aborts if cumulative cost exceeds this.
   */
  budget?: number;
}

/**
 * Agent that generates MCP servers from various inputs.
 *
 * The factory can generate complete MCP servers from:
 * - Natural language descriptions
 * - OpenAPI specifications
 * - Database schemas
 *
 * @example
 * ```typescript
 * // Using environment variables
 * const agent = new ToolFactoryAgent();
 *
 * // With explicit API key
 * const agent = new ToolFactoryAgent({ apiKey: 'your-key' });
 *
 * // With full config
 * const agent = new ToolFactoryAgent({
 *   config: {
 *     provider: LLMProvider.ANTHROPIC,
 *     model: 'claude-sonnet-4-5-20250929',
 *     apiKey: 'your-key',
 *     maxTokens: 4096,
 *     temperature: 0,
 *   }
 * });
 * ```
 */
/**
 * Error thrown when budget limit is exceeded during generation.
 */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class ToolFactoryAgent {
  private config: FactoryConfig;
  private provider: LLMProviderInterface | null = null;
  private serverGenerator: ServerGenerator;
  private docsGenerator: DocsGenerator;
  private testsGenerator: TestsGenerator;
  private totalCost = 0;
  private budgetLimit: number | null = null;
  private costBreakdown: Map<string, { cost: number; calls: number }> = new Map();
  private llmCallCount = 0;
  private totalTokensIn = 0;
  private totalTokensOut = 0;
  private currentPhase = 'unknown';

  /**
   * Initialize the Tool Factory Agent.
   *
   * @param options - Configuration options
   * @throws Error if API key is not set and requireLlm is true
   */
  constructor(options?: {
    config?: Partial<FactoryConfig>;
    apiKey?: string;
    model?: string;
    requireLlm?: boolean;
  }) {
    const { config, apiKey, model, requireLlm = true } = options ?? {};

    // Build config
    if (config) {
      this.config = createFactoryConfig(config);
    } else {
      this.config = getDefaultConfig();
    }

    // Override with explicit values
    if (apiKey) {
      this.config.apiKey = apiKey;
    }
    if (model) {
      this.config.model = model;
    }

    // Validate config
    if (requireLlm) {
      const errors = validateConfig(this.config);
      if (errors.length > 0) {
        throw new Error('Configuration errors:\n' + errors.map((e) => `  - ${e}`).join('\n'));
      }

      // Initialize provider
      this.provider = createProvider(this.config.provider, {
        apiKey: this.config.apiKey!,
        model: this.config.model,
        temperature: this.config.temperature,
      });
    }

    // Initialize generators
    this.serverGenerator = new ServerGenerator();
    this.docsGenerator = new DocsGenerator();
    this.testsGenerator = new TestsGenerator();
  }

  /**
   * Generate a complete MCP server from a natural language description.
   *
   * @param description - Natural language description of desired tools
   * @param options - Generation options
   * @returns GeneratedServer with all code and documentation
   */
  async generateFromDescription(
    description: string,
    options?: GenerateOptions
  ): Promise<GeneratedServer> {
    const {
      serverName = 'GeneratedToolServer',
      description: serverDescription,
      githubUsername,
      version = '1.0.0',
      webSearch = false,
      authEnvVars = [],
      includeHealthCheck = true,
      productionConfig,
      parallel = true,
      maxConcurrency = 5,
      skipCache = false,
      stream = false,
      onStreamToken,
      budget,
    } = options ?? {};

    // Reset cost tracking for this generation
    this.totalCost = 0;
    this.budgetLimit = budget ?? null;
    this.costBreakdown = new Map();
    this.llmCallCount = 0;
    this.totalTokensIn = 0;
    this.totalTokensOut = 0;

    // Streaming callback (only used if stream is enabled)
    const streamCallback = stream ? onStreamToken : undefined;

    // Initialize execution log
    const log = createGenerationLog(serverName);
    log.provider = this.config.provider;
    log.model = this.config.model;
    log.originalDescription = description;
    log.webSearchEnabled = webSearch;

    addStep(
      log,
      'init',
      `Starting generation of ${serverName} (parallel=${parallel}, maxConcurrency=${maxConcurrency}, stream=${stream})`
    );

    // Step 0: Optionally search web for more context
    let enhancedDescription = description;
    if (webSearch) {
      addStep(log, 'web_search', 'Starting web research for API documentation');
      const searchContext = await this.searchForContext(description, log);
      if (searchContext) {
        enhancedDescription = `${description}\n\n## Research Context:\n${searchContext}`;
      }
    }

    // Step 1: Extract tool specifications
    addStep(log, 'extract_specs', 'Sending prompt to LLM for tool extraction');
    this.currentPhase = 'tool_extraction';
    const toolSpecs = await this.extractToolSpecs(
      enhancedDescription,
      log,
      skipCache,
      streamCallback
    );
    log.toolsGenerated = toolSpecs.map((s) => s.name);

    // Step 2: Generate implementations (parallel or sequential)
    const implementations: Record<string, string> = {};

    this.currentPhase = 'implementation';
    if (parallel && toolSpecs.length > 1) {
      // Note: Streaming is disabled for parallel generation (tokens would be interleaved)
      addStep(
        log,
        'implement_parallel',
        `Generating ${toolSpecs.length} implementations in parallel (max ${maxConcurrency} concurrent)`
      );
      const results = await this.generateImplementationsParallel(
        toolSpecs,
        maxConcurrency,
        log,
        skipCache
      );
      Object.assign(implementations, results);
    } else {
      // Sequential generation - streaming supported
      for (const spec of toolSpecs) {
        addStep(log, 'implement', `Generating implementation for ${spec.name}`);
        const impl = await this.generateImplementation(spec, log, skipCache, streamCallback);
        implementations[spec.name] = impl;
      }
    }

    // Step 3: Extract resources
    addStep(log, 'extract_resources', 'Extracting resource specifications');
    this.currentPhase = 'resource_extraction';
    const resourceSpecs = await this.extractResourceSpecs(enhancedDescription, log, skipCache, streamCallback);

    // Step 4: Extract prompts
    addStep(log, 'extract_prompts', 'Extracting prompt specifications');
    this.currentPhase = 'prompt_extraction';
    const promptSpecs = await this.extractPromptSpecs(enhancedDescription, log, skipCache, streamCallback);

    // Step 5: Generate all artifacts
    addStep(log, 'artifacts', 'Generating server files');

    return this.generateArtifacts(serverName, toolSpecs, implementations, {
      log,
      authEnvVars,
      includeHealthCheck,
      productionConfig,
      description: serverDescription ?? description.slice(0, 200),
      githubUsername,
      version,
      resourceSpecs,
      promptSpecs,
    });
  }

  /**
   * Generate MCP server from an OpenAPI specification.
   *
   * @param openapiSpec - OpenAPI specification as object
   * @param options - Generation options
   * @returns GeneratedServer with all code and documentation
   */
  async generateFromOpenAPI(
    openapiSpec: Record<string, unknown>,
    options?: {
      baseUrl?: string;
      serverName?: string;
      description?: string;
      githubUsername?: string;
      version?: string;
    }
  ): Promise<GeneratedServer> {
    const {
      baseUrl,
      serverName = 'GeneratedAPIServer',
      description,
      githubUsername,
      version = '1.0.0',
    } = options ?? {};

    // Dynamic import to keep OpenAPI support optional
    const { OpenAPIServerGenerator } = await import('../openapi/index.js');

    const generator = new OpenAPIServerGenerator(openapiSpec, baseUrl);

    const serverCode = generator.generateServerCode(serverName);
    const toolSpecs = generator.getToolSpecs();
    const authEnvVars = generator.getAuthEnvVars();
    const specInfo = openapiSpec.info as Record<string, unknown> | undefined;
    const serverDesc =
      description ?? (specInfo?.description as string) ?? `MCP server for ${serverName}`;

    return createGeneratedServer({
      name: serverName,
      serverCode,
      toolSpecs,
      testCode: this.testsGenerator.generateTestFile(serverName, toolSpecs),
      dockerfile: this.serverGenerator.generateDockerfile(toolSpecs, authEnvVars),
      readme: this.docsGenerator.generateReadme(serverName, toolSpecs, { authEnvVars }),
      skillFile: this.docsGenerator.generateSkill(serverName, toolSpecs),
      packageJson: this.serverGenerator.generatePackageJson(serverName, toolSpecs, {
        githubUsername,
        description: serverDesc,
        version,
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, authEnvVars),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        authEnvVars,
        githubUsername,
        version,
        description: serverDesc,
      }),
      changelog: this.docsGenerator.generateChangelog(serverName, toolSpecs, version),
      toolsSpec: this.docsGenerator.generateToolsSpec(serverName, toolSpecs),
      apiDocsIndex: this.docsGenerator.generateApiDocsIndex(serverName, toolSpecs),
    });
  }

  /**
   * Generate MCP server from a database schema.
   *
   * @param databasePath - Path to SQLite file or PostgreSQL connection string
   * @param options - Generation options
   * @returns GeneratedServer with all code and documentation
   */
  async generateFromDatabase(
    databasePath: string,
    options?: {
      serverName?: string;
      description?: string;
      githubUsername?: string;
      version?: string;
      tables?: string[];
    }
  ): Promise<GeneratedServer> {
    const {
      serverName = 'GeneratedDatabaseServer',
      description,
      githubUsername,
      version = '1.0.0',
      tables,
    } = options ?? {};

    // Dynamic import to keep database support optional
    const { DatabaseServerGenerator, DatabaseType } = await import('../database/index.js');

    const generator = new DatabaseServerGenerator(databasePath);

    await generator.introspect(tables);

    const serverCode = generator.generateServerCode(serverName);
    const toolSpecs = generator.getToolSpecs();
    // Database type is auto-detected from connection string
    const authEnvVars =
      generator.dbType === DatabaseType.POSTGRESQL ? ['DATABASE_URL'] : ['DATABASE_PATH'];
    const serverDesc = description ?? `Database CRUD server for ${serverName}`;

    return createGeneratedServer({
      name: serverName,
      serverCode,
      toolSpecs,
      testCode: this.testsGenerator.generateTestFile(serverName, toolSpecs),
      dockerfile: this.serverGenerator.generateDockerfile(toolSpecs, authEnvVars),
      readme: this.docsGenerator.generateReadme(serverName, toolSpecs, { authEnvVars }),
      skillFile: this.docsGenerator.generateSkill(serverName, toolSpecs),
      packageJson: this.serverGenerator.generatePackageJson(serverName, toolSpecs, {
        githubUsername,
        description: serverDesc,
        version,
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, authEnvVars),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        authEnvVars,
        githubUsername,
        version,
        description: serverDesc,
      }),
      changelog: this.docsGenerator.generateChangelog(serverName, toolSpecs, version),
      toolsSpec: this.docsGenerator.generateToolsSpec(serverName, toolSpecs),
      apiDocsIndex: this.docsGenerator.generateApiDocsIndex(serverName, toolSpecs),
    });
  }

  /**
   * Generate MCP server from a GraphQL schema.
   *
   * @param schemaString - GraphQL SDL schema string
   * @param options - Generation options
   * @returns GeneratedServer with all code and documentation
   */
  async generateFromGraphQL(
    schemaString: string,
    options?: {
      endpoint?: string;
      serverName?: string;
      description?: string;
      githubUsername?: string;
      version?: string;
    }
  ): Promise<GeneratedServer> {
    const {
      endpoint,
      serverName = 'GeneratedGraphQLServer',
      description,
      githubUsername,
      version = '1.0.0',
    } = options ?? {};

    // Dynamic import to keep GraphQL support optional
    const { GraphQLServerGenerator } = await import('../graphql/index.js');

    const generator = new GraphQLServerGenerator(schemaString, endpoint);

    const serverCode = generator.generateServerCode(serverName);
    const toolSpecs = generator.getToolSpecs();
    const authEnvVars = generator.getAuthEnvVars();
    const serverDesc =
      description ?? `GraphQL MCP server for ${serverName}`;

    return createGeneratedServer({
      name: serverName,
      serverCode,
      toolSpecs,
      testCode: this.testsGenerator.generateTestFile(serverName, toolSpecs),
      dockerfile: this.serverGenerator.generateDockerfile(toolSpecs, authEnvVars),
      readme: this.docsGenerator.generateReadme(serverName, toolSpecs, { authEnvVars }),
      skillFile: this.docsGenerator.generateSkill(serverName, toolSpecs),
      packageJson: this.serverGenerator.generatePackageJson(serverName, toolSpecs, {
        githubUsername,
        description: serverDesc,
        version,
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, authEnvVars),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        authEnvVars,
        githubUsername,
        version,
        description: serverDesc,
      }),
      changelog: this.docsGenerator.generateChangelog(serverName, toolSpecs, version),
      toolsSpec: this.docsGenerator.generateToolsSpec(serverName, toolSpecs),
      apiDocsIndex: this.docsGenerator.generateApiDocsIndex(serverName, toolSpecs),
    });
  }

  /**
   * Generate MCP server from an ontology definition (RDF/OWL, JSON-LD, or custom YAML).
   *
   * @param content - Ontology content string
   * @param options - Generation options
   * @returns GeneratedServer with all code and documentation
   */
  async generateFromOntology(
    content: string,
    options?: {
      format?: 'rdf' | 'jsonld' | 'yaml';
      serverName?: string;
      description?: string;
      githubUsername?: string;
      version?: string;
    }
  ): Promise<GeneratedServer> {
    const {
      format,
      serverName = 'GeneratedOntologyServer',
      description,
      githubUsername,
      version = '1.0.0',
    } = options ?? {};

    // Dynamic import to keep ontology support optional
    const { OntologyParser, OntologyServerGenerator } = await import('../ontology/index.js');

    const parser = new OntologyParser();
    const definition = await parser.parse(content, format);

    const generator = new OntologyServerGenerator(definition);

    const serverCode = generator.generateServerCode(serverName);
    const toolSpecs = generator.getToolSpecs();
    const serverDesc =
      description ?? `Ontology-based MCP server for ${definition.name}`;

    return createGeneratedServer({
      name: serverName,
      serverCode,
      toolSpecs,
      testCode: this.testsGenerator.generateTestFile(serverName, toolSpecs),
      dockerfile: this.serverGenerator.generateDockerfile(toolSpecs, []),
      readme: this.docsGenerator.generateReadme(serverName, toolSpecs, {}),
      skillFile: this.docsGenerator.generateSkill(serverName, toolSpecs),
      packageJson: this.serverGenerator.generatePackageJson(serverName, toolSpecs, {
        githubUsername,
        description: serverDesc,
        version,
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, []),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        githubUsername,
        version,
        description: serverDesc,
      }),
      changelog: this.docsGenerator.generateChangelog(serverName, toolSpecs, version),
      toolsSpec: this.docsGenerator.generateToolsSpec(serverName, toolSpecs),
      apiDocsIndex: this.docsGenerator.generateApiDocsIndex(serverName, toolSpecs),
    });
  }

  /**
   * Search the web for API documentation and examples.
   */
  private async searchForContext(description: string, log?: GenerationLog): Promise<string | null> {
    try {
      // Dynamic import to keep web search optional
      const { searchForApiInfoWithLogging } = await import('../web-search/index.js');
      const { createExecutionLogger } = await import('../execution-logger/index.js');

      if (log) {
        addStep(log, 'web_search_start', 'Starting web search for API documentation');
      }

      // Create execution logger if we have a generation log
      const execLogger = log
        ? createExecutionLogger(
            log.serverName ?? 'unknown',
            this.config.provider,
            this.config.model
          )
        : undefined;

      const result = await searchForApiInfoWithLogging(
        description,
        this.config.provider,
        this.config.apiKey ?? '',
        this.config.model,
        execLogger
      );

      if (log && result) {
        addStep(log, 'web_search_complete', `Web search complete, got ${result.length} chars`);
      }

      return result || null;
    } catch (e) {
      if (log) {
        addStep(
          log,
          'web_search_error',
          `Web search failed: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      return null;
    }
  }

  /**
   * Extract tool specifications from natural language description.
   */
  private async extractToolSpecs(
    description: string,
    log?: GenerationLog,
    skipCache?: boolean,
    onStreamToken?: (token: string) => void
  ): Promise<ToolSpec[]> {
    const prompt = formatPrompt(EXTRACT_TOOLS_PROMPT, { description });

    const content = await this.callLlm(prompt, 4096, log, skipCache, onStreamToken);

    // Parse the LLM response
    const { data, error } = parseToolResponse(content);
    if (error) {
      throw new Error(`Failed to parse LLM response: ${error}`);
    }

    // Validate with Zod
    const { valid, errors } = validateToolSpecs(data);
    if (errors.length > 0 && valid.length === 0) {
      throw new Error(`Tool spec validation failed: ${errors.join(', ')}`);
    }

    // Convert to ToolSpec model objects
    return valid.map((spec) =>
      createToolSpec({
        name: spec.name,
        description: spec.description,
        inputSchema: spec.input_schema as unknown as ToolSpec['inputSchema'],
        outputSchema: (spec.output_schema ?? null) as ToolSpec['outputSchema'],
        implementationHints: spec.implementation_hints ?? null,
        dependencies: spec.dependencies,
      })
    );
  }

  /**
   * Extract resource specifications from description.
   */
  private async extractResourceSpecs(
    description: string,
    log?: GenerationLog,
    skipCache?: boolean,
    onStreamToken?: (token: string) => void
  ): Promise<ResourceSpec[]> {
    try {
      const prompt = formatPrompt(EXTRACT_RESOURCES_PROMPT, { description });
      const content = await this.callLlm(prompt, 2048, log, skipCache, onStreamToken);

      const { data, error } = parseToolResponse(content);
      if (error || !Array.isArray(data)) {
        if (log) addStep(log, 'resources_skip', 'No resources extracted');
        return [];
      }

      return (data as Record<string, unknown>[]).map((spec) =>
        createResourceSpec({
          uri: String(spec.uri ?? ''),
          name: String(spec.name ?? ''),
          description: String(spec.description ?? ''),
          mimeType: String(spec.mimeType ?? 'application/json'),
          template: Boolean(spec.template ?? false),
        })
      ).filter(r => r.uri && r.name);
    } catch {
      if (log) addStep(log, 'resources_error', 'Resource extraction failed, continuing without resources');
      return [];
    }
  }

  /**
   * Extract prompt specifications from description.
   */
  private async extractPromptSpecs(
    description: string,
    log?: GenerationLog,
    skipCache?: boolean,
    onStreamToken?: (token: string) => void
  ): Promise<PromptSpec[]> {
    try {
      const prompt = formatPrompt(EXTRACT_PROMPTS_PROMPT, { description });
      const content = await this.callLlm(prompt, 2048, log, skipCache, onStreamToken);

      const { data, error } = parseToolResponse(content);
      if (error || !Array.isArray(data)) {
        if (log) addStep(log, 'prompts_skip', 'No prompts extracted');
        return [];
      }

      return (data as Record<string, unknown>[]).map((spec) =>
        createPromptSpec({
          name: String(spec.name ?? ''),
          description: String(spec.description ?? ''),
          arguments: Array.isArray(spec.arguments) ? (spec.arguments as Record<string, unknown>[]).map((arg) => ({
            name: String(arg.name ?? ''),
            description: String(arg.description ?? ''),
            required: Boolean(arg.required ?? false),
          })) : [],
          template: String(spec.template ?? ''),
        })
      ).filter(p => p.name && p.template);
    } catch {
      if (log) addStep(log, 'prompts_error', 'Prompt extraction failed, continuing without prompts');
      return [];
    }
  }

  /**
   * Generate implementation for a single tool.
   */
  private async generateImplementation(
    spec: ToolSpec,
    log?: GenerationLog,
    skipCache?: boolean,
    onStreamToken?: (token: string) => void
  ): Promise<string> {
    const prompt = formatPrompt(GENERATE_IMPLEMENTATION_PROMPT, {
      name: spec.name,
      description: spec.description,
      input_schema: JSON.stringify(spec.inputSchema, null, 2),
      output_schema: spec.outputSchema ? JSON.stringify(spec.outputSchema, null, 2) : '{}',
      hints: spec.implementationHints ?? 'None provided',
      dependencies: spec.dependencies.length > 0 ? spec.dependencies.join(', ') : 'None',
    });

    const content = await this.callLlm(prompt, 2048, log, skipCache, onStreamToken);

    // Clean up markdown code blocks
    return extractCodeFromResponse(content);
  }

  /**
   * Generate implementations for multiple tools in parallel.
   *
   * Uses a semaphore-like approach to limit concurrency and avoid
   * overwhelming the LLM API with too many simultaneous requests.
   *
   * @param specs - Tool specifications to generate implementations for
   * @param maxConcurrency - Maximum concurrent LLM calls
   * @param log - Optional generation log
   * @param skipCache - Whether to skip the cache
   * @returns Map of tool names to implementations
   */
  private async generateImplementationsParallel(
    specs: ToolSpec[],
    maxConcurrency: number,
    log?: GenerationLog,
    skipCache?: boolean
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const pending: Promise<void>[] = [];
    let activeCount = 0;

    // Process each spec with concurrency control
    const processSpec = async (spec: ToolSpec): Promise<void> => {
      // Wait if at max concurrency
      while (activeCount >= maxConcurrency) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      activeCount++;
      try {
        if (log) {
          addStep(log, 'implement_start', `Starting implementation for ${spec.name}`);
        }

        const impl = await this.generateImplementation(spec, log, skipCache);
        results[spec.name] = impl;

        if (log) {
          addStep(log, 'implement_complete', `Completed implementation for ${spec.name}`);
        }
      } finally {
        activeCount--;
      }
    };

    // Start all tasks
    for (const spec of specs) {
      pending.push(processSpec(spec));
    }

    // Wait for all to complete
    await Promise.all(pending);

    return results;
  }

  /**
   * Call the LLM with the given prompt.
   */
  private async callLlm(
    prompt: string,
    maxTokens: number = 4096,
    log?: GenerationLog,
    skipCache?: boolean,
    onStreamToken?: (token: string) => void
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('LLM provider not initialized');
    }

    // Check budget before making the call
    if (this.budgetLimit !== null && this.totalCost > this.budgetLimit) {
      throw new BudgetExceededError(
        `Budget limit ${formatCost(this.budgetLimit)} exceeded (spent: ${formatCost(this.totalCost)})`
      );
    }

    let response: LLMResponse;

    if (onStreamToken) {
      // Use streaming if callback is provided
      response = await this.provider.callWithStreaming(
        SYSTEM_PROMPT,
        prompt,
        maxTokens,
        { onToken: onStreamToken },
        { skipCache }
      );
    } else {
      // Regular non-streaming call
      response = await this.provider.call(SYSTEM_PROMPT, prompt, maxTokens, {
        skipCache,
      });
    }

    // Check for errors
    if (response.error) {
      throw new Error(`LLM call failed: ${response.error}`);
    }

    // Track cost
    this.llmCallCount++;
    const callCost = response.cost ?? 0;
    this.totalCost += callCost;
    this.totalTokensIn += response.tokensIn ?? 0;
    this.totalTokensOut += response.tokensOut ?? 0;

    // Track cost by phase
    const phase = this.currentPhase;
    const existing = this.costBreakdown.get(phase);
    if (existing) {
      existing.cost += callCost;
      existing.calls += 1;
    } else {
      this.costBreakdown.set(phase, { cost: callCost, calls: 1 });
    }

    // Log the call
    if (log) {
      const cacheInfo = response.fromCache ? ' (from cache)' : '';
      const costInfo = callCost > 0 ? `, cost: ${formatCost(callCost)}` : '';
      addStep(
        log,
        'llm_call',
        `LLM call completed${cacheInfo}: ${response.tokensIn ?? '?'} in, ${response.tokensOut ?? '?'} out, ${Math.round(response.latencyMs)}ms${costInfo}`,
        prompt.slice(0, 500),
        response.text.slice(0, 500)
      );

      // Update log totals
      log.totalTokensIn = this.totalTokensIn;
      log.totalTokensOut = this.totalTokensOut;
      log.totalCost = this.totalCost;
      log.llmCallCount = this.llmCallCount;
      log.costBreakdown = [...this.costBreakdown.entries()].map(([p, info]) => ({
        phase: p,
        cost: info.cost,
        calls: info.calls,
      }));
    }

    // Check budget after the call
    if (this.budgetLimit !== null && this.totalCost > this.budgetLimit) {
      throw new BudgetExceededError(
        `Budget limit ${formatCost(this.budgetLimit)} exceeded (spent: ${formatCost(this.totalCost)})`
      );
    }

    return response.text;
  }

  /**
   * Generate all server artifacts from specs and implementations.
   */
  private generateArtifacts(
    serverName: string,
    toolSpecs: ToolSpec[],
    implementations: Record<string, string>,
    options: {
      log?: GenerationLog;
      authEnvVars?: string[];
      includeHealthCheck?: boolean;
      productionConfig?: ProductionConfig;
      description?: string;
      githubUsername?: string;
      version?: string;
      resourceSpecs?: ResourceSpec[];
      promptSpecs?: PromptSpec[];
    }
  ): GeneratedServer {
    const {
      log,
      authEnvVars = [],
      includeHealthCheck = true,
      productionConfig,
      description,
      githubUsername,
      version = '1.0.0',
      resourceSpecs = [],
      promptSpecs = [],
    } = options;

    // Collect dependencies
    const allDeps = new Set<string>();
    for (const spec of toolSpecs) {
      for (const dep of spec.dependencies) {
        allDeps.add(dep);
      }
    }
    if (log) {
      log.dependenciesUsed = [...allDeps];
    }

    return createGeneratedServer({
      name: serverName,
      serverCode: this.serverGenerator.generateServer(serverName, toolSpecs, implementations, {
        authEnvVars,
        includeHealthCheck,
        productionConfig,
        resourceSpecs,
        promptSpecs,
      }),
      toolSpecs,
      resourceSpecs,
      promptSpecs,
      testCode: this.testsGenerator.generateTestFile(serverName, toolSpecs),
      dockerfile: this.serverGenerator.generateDockerfile(toolSpecs, authEnvVars),
      readme: this.docsGenerator.generateReadme(serverName, toolSpecs, { authEnvVars }),
      skillFile: this.docsGenerator.generateSkill(serverName, toolSpecs),
      packageJson: this.serverGenerator.generatePackageJson(serverName, toolSpecs, {
        productionConfig,
        githubUsername,
        description,
        version,
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, authEnvVars),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        authEnvVars,
        githubUsername,
        version,
        description,
      }),
      changelog: this.docsGenerator.generateChangelog(serverName, toolSpecs, version),
      toolsSpec: this.docsGenerator.generateToolsSpec(serverName, toolSpecs),
      apiDocsIndex: this.docsGenerator.generateApiDocsIndex(serverName, toolSpecs),
      executionLog: log,
    });
  }
}
