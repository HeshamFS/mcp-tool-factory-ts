/**
 * Main Tool Factory Agent for generating MCP servers.
 */

import type { FactoryConfig } from '../config/config.js';
import { getDefaultConfig, validateConfig, createFactoryConfig } from '../config/config.js';
import { LLMProvider } from '../config/providers.js';
import type { BaseLLMProvider, LLMResponse } from '../providers/base.js';
import { createProvider } from '../providers/factory.js';
import type { ToolSpec, GeneratedServer, GenerationLog } from '../models/index.js';
import { createToolSpec, createGeneratedServer, createGenerationLog, addStep } from '../models/index.js';
import { ServerGenerator, type ProductionConfig } from '../generators/server.js';
import { DocsGenerator } from '../generators/docs.js';
import { TestsGenerator } from '../generators/tests.js';
import {
  SYSTEM_PROMPT,
  EXTRACT_TOOLS_PROMPT,
  GENERATE_IMPLEMENTATION_PROMPT,
  formatPrompt,
} from '../prompts/prompts.js';
import { parseToolResponse, validateToolSpecs, extractCodeFromResponse } from '../validation/index.js';

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
export class ToolFactoryAgent {
  private config: FactoryConfig;
  private provider: BaseLLMProvider | null = null;
  private serverGenerator: ServerGenerator;
  private docsGenerator: DocsGenerator;
  private testsGenerator: TestsGenerator;

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
    } = options ?? {};

    // Initialize execution log
    const log = createGenerationLog(serverName);
    log.provider = this.config.provider;
    log.model = this.config.model;
    log.originalDescription = description;
    log.webSearchEnabled = webSearch;

    addStep(log, 'init', `Starting generation of ${serverName}`);

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
    const toolSpecs = await this.extractToolSpecs(enhancedDescription, log);
    log.toolsGenerated = toolSpecs.map((s) => s.name);

    // Step 2: Generate implementations
    const implementations: Record<string, string> = {};
    for (const spec of toolSpecs) {
      addStep(log, 'implement', `Generating implementation for ${spec.name}`);
      const impl = await this.generateImplementation(spec, log);
      implementations[spec.name] = impl;
    }

    // Step 3: Generate all artifacts
    addStep(log, 'artifacts', 'Generating server files');

    return this.generateArtifacts(serverName, toolSpecs, implementations, {
      log,
      authEnvVars,
      includeHealthCheck,
      productionConfig,
      description: serverDescription ?? description.slice(0, 200),
      githubUsername,
      version,
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
    const serverDesc = description ?? (specInfo?.description as string) ?? `MCP server for ${serverName}`;

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
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, authEnvVars),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        authEnvVars,
        githubUsername,
        version,
        description: serverDesc,
      }),
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
    const authEnvVars = generator.dbType === DatabaseType.POSTGRESQL ? ['DATABASE_URL'] : ['DATABASE_PATH'];
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
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, authEnvVars),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        authEnvVars,
        githubUsername,
        version,
        description: serverDesc,
      }),
    });
  }

  /**
   * Search the web for API documentation and examples.
   */
  private async searchForContext(
    description: string,
    log?: GenerationLog
  ): Promise<string | null> {
    try {
      // Dynamic import to keep web search optional
      const { searchForApiInfoWithLogging } = await import('../web-search/index.js');
      const { createExecutionLogger } = await import('../execution-logger/index.js');

      if (log) {
        addStep(log, 'web_search_start', 'Starting web search for API documentation');
      }

      // Create execution logger if we have a generation log
      const execLogger = log
        ? createExecutionLogger(log.serverName ?? 'unknown', this.config.provider, this.config.model)
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
        addStep(log, 'web_search_error', `Web search failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      return null;
    }
  }

  /**
   * Extract tool specifications from natural language description.
   */
  private async extractToolSpecs(
    description: string,
    log?: GenerationLog
  ): Promise<ToolSpec[]> {
    const prompt = formatPrompt(EXTRACT_TOOLS_PROMPT, { description });

    const content = await this.callLlm(prompt, 4096, log);

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
   * Generate implementation for a single tool.
   */
  private async generateImplementation(
    spec: ToolSpec,
    log?: GenerationLog
  ): Promise<string> {
    const prompt = formatPrompt(GENERATE_IMPLEMENTATION_PROMPT, {
      name: spec.name,
      description: spec.description,
      input_schema: JSON.stringify(spec.inputSchema, null, 2),
      output_schema: spec.outputSchema ? JSON.stringify(spec.outputSchema, null, 2) : '{}',
      hints: spec.implementationHints ?? 'None provided',
      dependencies: spec.dependencies.length > 0 ? spec.dependencies.join(', ') : 'None',
    });

    const content = await this.callLlm(prompt, 2048, log);

    // Clean up markdown code blocks
    return extractCodeFromResponse(content);
  }

  /**
   * Call the LLM with the given prompt.
   */
  private async callLlm(
    prompt: string,
    maxTokens: number = 4096,
    log?: GenerationLog
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('LLM provider not initialized');
    }

    const response: LLMResponse = await this.provider.call(SYSTEM_PROMPT, prompt, maxTokens);

    // Check for errors
    if (response.error) {
      throw new Error(`LLM call failed: ${response.error}`);
    }

    // Log the call
    if (log) {
      addStep(
        log,
        'llm_call',
        `LLM call completed: ${response.tokensIn ?? '?'} in, ${response.tokensOut ?? '?'} out, ${Math.round(response.latencyMs)}ms`,
        prompt.slice(0, 500),
        response.text.slice(0, 500)
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
      serverCode: this.serverGenerator.generateServer(
        serverName,
        toolSpecs,
        implementations,
        { authEnvVars, includeHealthCheck, productionConfig }
      ),
      toolSpecs,
      testCode: this.testsGenerator.generateTestFile(serverName, toolSpecs),
      dockerfile: this.serverGenerator.generateDockerfile(toolSpecs, authEnvVars),
      readme: this.docsGenerator.generateReadme(serverName, toolSpecs, { authEnvVars }),
      skillFile: this.docsGenerator.generateSkill(serverName, toolSpecs),
      packageJson: this.serverGenerator.generatePackageJson(serverName, toolSpecs, {
        productionConfig,
        githubUsername,
        description,
      }),
      tsconfigJson: this.serverGenerator.generateTsConfig(),
      githubActions: this.serverGenerator.generateGitHubActions(serverName, authEnvVars),
      serverJson: this.serverGenerator.generateServerJson(serverName, toolSpecs, {
        authEnvVars,
        githubUsername,
        version,
        description,
      }),
      executionLog: log,
    });
  }
}
