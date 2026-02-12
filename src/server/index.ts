#!/usr/bin/env node
/**
 * MCP Tool Factory Server
 *
 * An MCP server that exposes tools for generating MCP servers.
 * This allows LLMs like Claude to generate MCP servers on-the-fly.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ToolFactoryAgent } from '../agent/index.js';
import {
  LLMProvider,
  DEFAULT_MODELS,
  API_KEY_ENV_VARS,
  CLAUDE_MODELS,
  OPENAI_MODELS,
  GOOGLE_MODELS,
  MISTRAL_MODELS,
  DEEPSEEK_MODELS,
  GROQ_MODELS,
  XAI_MODELS,
  COHERE_MODELS,
} from '../config/providers.js';
import { validateTypeScriptCode } from '../validation/parser.js';

// Server metadata
const SERVER_NAME = 'mcp-tool-factory';
const SERVER_VERSION = '0.3.0';

/**
 * Create and configure the MCP server.
 */
function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // ============================================================
  // Tool: generate_mcp_server
  // ============================================================
  server.tool(
    'generate_mcp_server',
    'Generate a complete MCP server from a natural language description. Returns TypeScript code, tests, documentation, and configuration files.',
    {
      description: z
        .string()
        .describe('Natural language description of the tools you want to create'),
      serverName: z
        .string()
        .optional()
        .describe('Name for the generated server (default: GeneratedToolServer)'),
      webSearch: z
        .boolean()
        .optional()
        .describe('Search the web for API documentation before generating (default: false)'),
      authEnvVars: z
        .array(z.string())
        .optional()
        .describe(
          'Environment variables required for authentication (e.g., ["API_KEY", "SECRET"])'
        ),
      includeHealthCheck: z
        .boolean()
        .optional()
        .describe('Include a health check tool (default: true)'),
      enableLogging: z
        .boolean()
        .optional()
        .describe('Enable structured logging with pino (default: false)'),
      enableMetrics: z.boolean().optional().describe('Enable Prometheus metrics (default: false)'),
      enableRateLimiting: z.boolean().optional().describe('Enable rate limiting (default: false)'),
      rateLimitRequests: z
        .number()
        .optional()
        .describe('Rate limit requests per minute (default: 100)'),
      enableRetries: z
        .boolean()
        .optional()
        .describe('Enable retry logic with exponential backoff (default: false)'),
      githubUsername: z
        .string()
        .optional()
        .describe('GitHub username for MCP Registry publishing (creates io.github.<user>/<name>)'),
      version: z.string().optional().describe('Version for the generated server (default: 1.0.0)'),
      parallel: z
        .boolean()
        .optional()
        .describe('Generate tool implementations in parallel (default: true)'),
      maxConcurrency: z
        .number()
        .optional()
        .describe('Maximum concurrent LLM calls when parallel (default: 5)'),
      skipCache: z.boolean().optional().describe('Skip the LLM response cache (default: false)'),
    },
    async (params) => {
      try {
        const envProvider = process.env.MCP_FACTORY_PROVIDER;
        const envModel = process.env.MCP_FACTORY_MODEL;
        const envBudget = process.env.MCP_FACTORY_BUDGET;

        const agent = new ToolFactoryAgent({
          ...(envProvider || envModel
            ? {
                config: {
                  ...(envProvider ? { provider: envProvider as LLMProvider } : {}),
                  ...(envModel ? { model: envModel } : {}),
                },
              }
            : {}),
        });

        const result = await agent.generateFromDescription(params.description, {
          serverName: params.serverName,
          webSearch: params.webSearch,
          authEnvVars: params.authEnvVars,
          includeHealthCheck: params.includeHealthCheck,
          githubUsername: params.githubUsername,
          version: params.version,
          parallel: params.parallel,
          maxConcurrency: params.maxConcurrency,
          skipCache: params.skipCache,
          budget: envBudget ? parseFloat(envBudget) : undefined,
          productionConfig: {
            enableLogging: params.enableLogging,
            enableMetrics: params.enableMetrics,
            enableRateLimiting: params.enableRateLimiting,
            rateLimitRequests: params.rateLimitRequests,
            enableRetries: params.enableRetries,
          },
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  serverName: result.name,
                  toolsGenerated: result.toolSpecs.map((t) => ({
                    name: t.name,
                    description: t.description,
                  })),
                  files: {
                    'src/index.ts': result.serverCode,
                    'package.json': result.packageJson,
                    'tsconfig.json': result.tsconfigJson,
                    'README.md': result.readme,
                    Dockerfile: result.dockerfile,
                    'server.json': result.serverJson,
                    'tests/tools.test.ts': result.testCode,
                    '.github/workflows/ci.yml': result.githubActions,
                    'skill.md': result.skillFile,
                  },
                  instructions:
                    'Write these files to a directory, then run: npm install && npx tsx src/index.ts',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool: generate_from_openapi
  // ============================================================
  server.tool(
    'generate_from_openapi',
    'Generate an MCP server from an OpenAPI specification. Converts REST API endpoints to MCP tools.',
    {
      openapiSpec: z.string().describe('OpenAPI specification as JSON or YAML string'),
      serverName: z.string().optional().describe('Name for the generated server'),
      baseUrl: z
        .string()
        .optional()
        .describe('Base URL for the API (auto-detected from spec if not provided)'),
      githubUsername: z.string().optional().describe('GitHub username for MCP Registry publishing'),
      version: z.string().optional().describe('Version for the generated server (default: 1.0.0)'),
    },
    async (params) => {
      try {
        // Parse the OpenAPI spec
        let spec: Record<string, unknown>;
        try {
          spec = JSON.parse(params.openapiSpec);
        } catch {
          // Try YAML
          const yaml = await import('js-yaml');
          spec = yaml.load(params.openapiSpec) as Record<string, unknown>;
        }

        const agent = new ToolFactoryAgent({ requireLlm: false });

        const result = await agent.generateFromOpenAPI(spec, {
          serverName: params.serverName,
          baseUrl: params.baseUrl,
          githubUsername: params.githubUsername,
          version: params.version,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  serverName: result.name,
                  toolsGenerated: result.toolSpecs.map((t) => ({
                    name: t.name,
                    description: t.description,
                  })),
                  files: {
                    'src/index.ts': result.serverCode,
                    'package.json': result.packageJson,
                    'tsconfig.json': result.tsconfigJson,
                    'README.md': result.readme,
                    Dockerfile: result.dockerfile,
                    'server.json': result.serverJson,
                    'tests/tools.test.ts': result.testCode,
                    '.github/workflows/ci.yml': result.githubActions,
                  },
                  instructions:
                    'Write these files to a directory, then run: npm install && npx tsx src/index.ts',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool: generate_from_database
  // ============================================================
  server.tool(
    'generate_from_database',
    'Generate an MCP server with CRUD tools from a database schema. Supports SQLite and PostgreSQL.',
    {
      connectionString: z
        .string()
        .describe(
          'Database connection string. For SQLite: path to .db file. For PostgreSQL: postgresql://user:pass@host/db'
        ),
      serverName: z.string().optional().describe('Name for the generated server'),
      tables: z
        .array(z.string())
        .optional()
        .describe('Specific tables to include (default: all tables)'),
      githubUsername: z.string().optional().describe('GitHub username for MCP Registry publishing'),
      version: z.string().optional().describe('Version for the generated server (default: 1.0.0)'),
    },
    async (params) => {
      try {
        const agent = new ToolFactoryAgent({ requireLlm: false });

        const result = await agent.generateFromDatabase(params.connectionString, {
          serverName: params.serverName,
          tables: params.tables,
          githubUsername: params.githubUsername,
          version: params.version,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  serverName: result.name,
                  toolsGenerated: result.toolSpecs.map((t) => ({
                    name: t.name,
                    description: t.description,
                  })),
                  files: {
                    'src/index.ts': result.serverCode,
                    'package.json': result.packageJson,
                    'tsconfig.json': result.tsconfigJson,
                    'README.md': result.readme,
                    Dockerfile: result.dockerfile,
                    'server.json': result.serverJson,
                    'tests/tools.test.ts': result.testCode,
                    '.github/workflows/ci.yml': result.githubActions,
                  },
                  instructions:
                    'Write these files to a directory, then run: npm install && npx tsx src/index.ts',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool: generate_from_graphql
  // ============================================================
  server.tool(
    'generate_from_graphql',
    'Generate an MCP server from a GraphQL SDL schema. Converts queries and mutations to MCP tools.',
    {
      graphqlSchema: z.string().describe('GraphQL SDL schema string'),
      endpoint: z
        .string()
        .optional()
        .describe('GraphQL endpoint URL (default: http://localhost:4000/graphql)'),
      serverName: z.string().optional().describe('Name for the generated server'),
      githubUsername: z.string().optional().describe('GitHub username for MCP Registry publishing'),
      version: z.string().optional().describe('Version for the generated server (default: 1.0.0)'),
    },
    async (params) => {
      try {
        const agent = new ToolFactoryAgent({ requireLlm: false });

        const result = await agent.generateFromGraphQL(params.graphqlSchema, {
          serverName: params.serverName,
          endpoint: params.endpoint,
          githubUsername: params.githubUsername,
          version: params.version,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  serverName: result.name,
                  toolsGenerated: result.toolSpecs.map((t) => ({
                    name: t.name,
                    description: t.description,
                  })),
                  files: {
                    'src/index.ts': result.serverCode,
                    'package.json': result.packageJson,
                    'tsconfig.json': result.tsconfigJson,
                    'README.md': result.readme,
                    Dockerfile: result.dockerfile,
                    'server.json': result.serverJson,
                    'tests/tools.test.ts': result.testCode,
                    '.github/workflows/ci.yml': result.githubActions,
                  },
                  instructions:
                    'Write these files to a directory, then run: npm install && npx tsx src/index.ts',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool: generate_from_ontology
  // ============================================================
  server.tool(
    'generate_from_ontology',
    'Generate an MCP server from an ontology definition (RDF/OWL, JSON-LD, or custom YAML). Creates CRUD tools for each class and relationship tools for object properties.',
    {
      ontologyContent: z.string().describe('The ontology content (RDF/Turtle, JSON-LD, or YAML)'),
      format: z
        .enum(['rdf', 'jsonld', 'yaml'])
        .optional()
        .describe('Ontology format (auto-detected if not specified, default: yaml)'),
      serverName: z.string().optional().describe('Name for the generated server'),
      githubUsername: z.string().optional().describe('GitHub username for MCP Registry publishing'),
      version: z.string().optional().describe('Version for the generated server (default: 1.0.0)'),
    },
    async (params) => {
      try {
        const agent = new ToolFactoryAgent({ requireLlm: false });

        const result = await agent.generateFromOntology(params.ontologyContent, {
          format: params.format,
          serverName: params.serverName,
          githubUsername: params.githubUsername,
          version: params.version,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  serverName: result.name,
                  toolsGenerated: result.toolSpecs.map((t) => ({
                    name: t.name,
                    description: t.description,
                  })),
                  files: {
                    'src/index.ts': result.serverCode,
                    'package.json': result.packageJson,
                    'tsconfig.json': result.tsconfigJson,
                    'README.md': result.readme,
                    Dockerfile: result.dockerfile,
                    'server.json': result.serverJson,
                    'tests/tools.test.ts': result.testCode,
                    '.github/workflows/ci.yml': result.githubActions,
                  },
                  instructions:
                    'Write these files to a directory, then run: npm install && npx tsx src/index.ts',
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool: validate_typescript
  // ============================================================
  server.tool(
    'validate_typescript',
    'Validate TypeScript code for syntax errors. Useful for checking generated server code.',
    {
      code: z.string().describe('TypeScript code to validate'),
    },
    async (params) => {
      try {
        const result = await validateTypeScriptCode(params.code);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  valid: result.valid,
                  errors: result.errors,
                  errorSummary: result.error,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valid: false,
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );

  // ============================================================
  // Tool: list_providers
  // ============================================================
  server.tool(
    'list_providers',
    'List all 10 supported LLM providers, their models, and configuration status.',
    {},
    async () => {
      const MODEL_LISTS: Record<string, Record<string, string>> = {
        [LLMProvider.ANTHROPIC]: CLAUDE_MODELS,
        [LLMProvider.CLAUDE_CODE]: CLAUDE_MODELS,
        [LLMProvider.OPENAI]: OPENAI_MODELS,
        [LLMProvider.GOOGLE]: GOOGLE_MODELS,
        [LLMProvider.MISTRAL]: MISTRAL_MODELS,
        [LLMProvider.DEEPSEEK]: DEEPSEEK_MODELS,
        [LLMProvider.GROQ]: GROQ_MODELS,
        [LLMProvider.XAI]: XAI_MODELS,
        [LLMProvider.COHERE]: COHERE_MODELS,
      };

      const PROVIDER_NAMES: Record<string, string> = {
        [LLMProvider.ANTHROPIC]: 'Anthropic Claude',
        [LLMProvider.CLAUDE_CODE]: 'Claude Code (OAuth)',
        [LLMProvider.OPENAI]: 'OpenAI',
        [LLMProvider.GOOGLE]: 'Google Gemini',
        [LLMProvider.MISTRAL]: 'Mistral AI',
        [LLMProvider.DEEPSEEK]: 'DeepSeek',
        [LLMProvider.GROQ]: 'Groq',
        [LLMProvider.XAI]: 'xAI Grok',
        [LLMProvider.AZURE]: 'Azure OpenAI',
        [LLMProvider.COHERE]: 'Cohere',
      };

      const PROVIDER_DESCRIPTIONS: Record<string, string> = {
        [LLMProvider.ANTHROPIC]: 'Highest quality for complex tool generation',
        [LLMProvider.CLAUDE_CODE]: 'Zero-config for Claude Code users (auto-injected token)',
        [LLMProvider.OPENAI]: 'Fast generation with GPT-5 series and o-series reasoning',
        [LLMProvider.GOOGLE]: 'Cost-effective with 1M token context window',
        [LLMProvider.MISTRAL]: 'European AI with strong code generation (Codestral)',
        [LLMProvider.DEEPSEEK]: 'Ultra low cost with 671B MoE architecture',
        [LLMProvider.GROQ]: 'Ultra-fast inference on open-source models',
        [LLMProvider.XAI]: 'Grok reasoning models with code specialization',
        [LLMProvider.AZURE]: 'Enterprise-grade with Azure compliance and SLAs',
        [LLMProvider.COHERE]: 'Enterprise search and RAG-optimized models',
      };

      const providers = Object.values(LLMProvider).map((id) => ({
        id,
        name: PROVIDER_NAMES[id] ?? id,
        envVar: API_KEY_ENV_VARS[id],
        isConfigured: !!process.env[API_KEY_ENV_VARS[id]],
        defaultModel: DEFAULT_MODELS[id],
        models: Object.keys(MODEL_LISTS[id] ?? {}),
        description: PROVIDER_DESCRIPTIONS[id] ?? '',
      }));

      const activeProvider = process.env.MCP_FACTORY_PROVIDER ?? null;
      const activeModel = process.env.MCP_FACTORY_MODEL ?? null;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                providers,
                activeOverrides: {
                  provider: activeProvider,
                  model: activeModel,
                },
                note: 'Set one provider API key in env. Use MCP_FACTORY_PROVIDER and MCP_FACTORY_MODEL to override auto-detection. Claude Code users need no configuration.',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ============================================================
  // Tool: get_factory_info
  // ============================================================
  server.tool(
    'get_factory_info',
    'Get information about MCP Tool Factory capabilities and usage.',
    {},
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                name: 'MCP Tool Factory',
                version: SERVER_VERSION,
                description:
                  'Generate production-ready MCP servers from natural language, OpenAPI specs, database schemas, GraphQL schemas, or ontologies.',
                capabilities: [
                  'Generate MCP servers from natural language descriptions',
                  'Convert OpenAPI specifications to MCP servers',
                  'Generate CRUD tools from SQLite or PostgreSQL databases',
                  'Convert GraphQL schemas to MCP servers',
                  'Generate servers from ontologies (RDF/OWL, JSON-LD, YAML)',
                  'Validate TypeScript code',
                  '10 LLM providers via Vercel AI SDK: Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq, xAI, Azure, Cohere, Claude Code',
                  'Cost tracking with per-call pricing, budget limits, and provider cost comparison',
                  'Configurable via MCP_FACTORY_PROVIDER, MCP_FACTORY_MODEL, MCP_FACTORY_BUDGET env vars',
                  'Production features: logging, metrics, rate limiting, retries',
                  'MCP Registry publishing support',
                ],
                tools: [
                  {
                    name: 'generate_mcp_server',
                    description: 'Generate from natural language',
                  },
                  {
                    name: 'generate_from_openapi',
                    description: 'Generate from OpenAPI spec',
                  },
                  {
                    name: 'generate_from_database',
                    description: 'Generate from database schema',
                  },
                  {
                    name: 'generate_from_graphql',
                    description: 'Generate from GraphQL schema',
                  },
                  {
                    name: 'generate_from_ontology',
                    description: 'Generate from ontology (RDF/OWL, JSON-LD, YAML)',
                  },
                  {
                    name: 'validate_typescript',
                    description: 'Validate TypeScript code',
                  },
                  {
                    name: 'list_providers',
                    description: 'List LLM providers',
                  },
                ],
                repository: 'https://github.com/HeshamFS/mcp-tool-factory-ts',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}

// Run the server
main().catch((error) => {
  console.error('Failed to start MCP Tool Factory server:', error);
  process.exit(1);
});
