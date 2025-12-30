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
import { LLMProvider } from '../config/providers.js';
import { validateTypeScriptCode } from '../validation/parser.js';

// Server metadata
const SERVER_NAME = 'mcp-tool-factory';
const SERVER_VERSION = '0.1.0';

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
        .describe('Environment variables required for authentication (e.g., ["API_KEY", "SECRET"])'),
      includeHealthCheck: z
        .boolean()
        .optional()
        .describe('Include a health check tool (default: true)'),
      enableLogging: z
        .boolean()
        .optional()
        .describe('Enable structured logging with pino (default: false)'),
      enableMetrics: z
        .boolean()
        .optional()
        .describe('Enable Prometheus metrics (default: false)'),
      enableRateLimiting: z
        .boolean()
        .optional()
        .describe('Enable rate limiting (default: false)'),
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
      version: z
        .string()
        .optional()
        .describe('Version for the generated server (default: 1.0.0)'),
    },
    async (params) => {
      try {
        const agent = new ToolFactoryAgent();

        const result = await agent.generateFromDescription(params.description, {
          serverName: params.serverName,
          webSearch: params.webSearch,
          authEnvVars: params.authEnvVars,
          includeHealthCheck: params.includeHealthCheck,
          githubUsername: params.githubUsername,
          version: params.version,
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
                    'Dockerfile': result.dockerfile,
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
      openapiSpec: z
        .string()
        .describe('OpenAPI specification as JSON or YAML string'),
      serverName: z
        .string()
        .optional()
        .describe('Name for the generated server'),
      baseUrl: z
        .string()
        .optional()
        .describe('Base URL for the API (auto-detected from spec if not provided)'),
      githubUsername: z
        .string()
        .optional()
        .describe('GitHub username for MCP Registry publishing'),
      version: z
        .string()
        .optional()
        .describe('Version for the generated server (default: 1.0.0)'),
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
                    'Dockerfile': result.dockerfile,
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
      serverName: z
        .string()
        .optional()
        .describe('Name for the generated server'),
      tables: z
        .array(z.string())
        .optional()
        .describe('Specific tables to include (default: all tables)'),
      githubUsername: z
        .string()
        .optional()
        .describe('GitHub username for MCP Registry publishing'),
      version: z
        .string()
        .optional()
        .describe('Version for the generated server (default: 1.0.0)'),
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
                    'Dockerfile': result.dockerfile,
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
    'List available LLM providers and their configuration requirements.',
    {},
    async () => {
      const providers = [
        {
          id: LLMProvider.ANTHROPIC,
          name: 'Anthropic Claude',
          envVar: 'ANTHROPIC_API_KEY',
          models: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-haiku-4-5-20251001'],
          defaultModel: 'claude-sonnet-4-5-20250929',
          description: 'Best quality for complex tool generation',
        },
        {
          id: LLMProvider.CLAUDE_CODE,
          name: 'Claude Code',
          envVar: 'CLAUDE_CODE_OAUTH_TOKEN',
          models: ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-haiku-4-5-20251001'],
          defaultModel: 'claude-sonnet-4-5-20250929',
          description: 'Use Claude Code OAuth token (for Claude Code users)',
        },
        {
          id: LLMProvider.OPENAI,
          name: 'OpenAI GPT',
          envVar: 'OPENAI_API_KEY',
          models: ['gpt-5.2', 'gpt-5.2-codex', 'gpt-5.1', 'gpt-5', 'gpt-5-mini'],
          defaultModel: 'gpt-5.2',
          description: 'Fast generation with good quality',
        },
        {
          id: LLMProvider.GOOGLE,
          name: 'Google Gemini',
          envVar: 'GOOGLE_API_KEY',
          models: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'],
          defaultModel: 'gemini-3-flash-preview',
          description: 'Cost-effective with large context window',
        },
      ];

      // Check which providers are configured
      const configured = providers.map((p) => ({
        ...p,
        isConfigured: !!process.env[p.envVar],
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                providers: configured,
                note: 'At least one provider API key is required. Set the environment variable for your preferred provider. The factory will auto-detect which provider to use.',
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
                  'Generate production-ready MCP servers from natural language, OpenAPI specs, or database schemas.',
                capabilities: [
                  'Generate MCP servers from natural language descriptions',
                  'Convert OpenAPI specifications to MCP servers',
                  'Generate CRUD tools from SQLite or PostgreSQL databases',
                  'Validate TypeScript code',
                  'Support for multiple LLM providers (Claude, Claude Code, OpenAI GPT, Google Gemini)',
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
