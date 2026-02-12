# Architecture

System design and internal structure of MCP Tool Factory.

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MCP Tool Factory                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Natural  │ │ OpenAPI  │ │ Database │ │ GraphQL  │ │ Ontology │   │
│  │ Language │ │  Spec    │ │  Schema  │ │  SDL     │ │ RDF/YAML │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │            │            │            │            │           │
│       ▼            ▼            ▼            ▼            ▼           │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                     ToolFactoryAgent                            │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  UnifiedLLMProvider (Vercel AI SDK)                   │   │   │
│  │  │  Anthropic │ OpenAI │ Google │ Mistral │ DeepSeek    │   │   │
│  │  │  Groq │ xAI │ Azure │ Cohere + Claude Code OAuth    │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────┐  ┌──────────────┐                            │   │
│  │  │  LLM Cache   │  │  Cost        │                            │   │
│  │  │  (TTL-based) │  │  Tracking    │                            │   │
│  │  └──────────────┘  └──────────────┘                            │   │
│  └────────────────────────────────────────────────────────────────┘   │
│       │                                                               │
│       ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                       Generators                                │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                │   │
│  │  │   Server   │  │    Docs    │  │   Tests    │                │   │
│  │  │ Generator  │  │ Generator  │  │ Generator  │                │   │
│  │  └────────────┘  └────────────┘  └────────────┘                │   │
│  └────────────────────────────────────────────────────────────────┘   │
│       │                                                               │
│       ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                     GeneratedServer                              │   │
│  │  serverCode │ toolSpecs │ resourceSpecs │ promptSpecs            │   │
│  │  tests │ README │ Dockerfile │ CI/CD │ server.json │ CHANGELOG  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Core Components

### ToolFactoryAgent

The main orchestrator that coordinates generation from all input sources.

```typescript
class ToolFactoryAgent {
  // LLM provider for natural language generation
  private provider: BaseLLMProvider;

  // Code generators
  private serverGenerator: ServerGenerator;
  private docsGenerator: DocsGenerator;
  private testsGenerator: TestsGenerator;

  // Generation methods
  async generateFromDescription(description: string, options?: GenerateOptions): Promise<GeneratedServer>;
  async generateFromOpenAPI(spec: object): Promise<GeneratedServer>;
  async generateFromDatabase(path: string): Promise<GeneratedServer>;
  async generateFromGraphQL(schemaString: string, options?: { endpoint?: string }): Promise<GeneratedServer>;
  async generateFromOntology(content: string, options?: { format?: 'rdf' | 'jsonld' | 'yaml' }): Promise<GeneratedServer>;
}
```

When generating from natural language descriptions, the agent makes separate LLM calls to extract:
1. **Tool specifications** - via `EXTRACT_TOOLS_PROMPT`
2. **Resource specifications** - via `EXTRACT_RESOURCES_PROMPT`
3. **Prompt specifications** - via `EXTRACT_PROMPTS_PROMPT`
4. **Tool implementations** - via `GENERATE_IMPLEMENTATION_PROMPT` (one per tool, run in parallel by default)

### LLM Providers

Abstract interface for LLM providers:

```typescript
abstract class BaseLLMProvider {
  abstract call(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number
  ): Promise<LLMResponse>;
}

interface LLMResponse {
  text: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
  latencyMs: number;
  model?: string | null;
  error?: string | null;
  fromCache?: boolean;
  /** Detailed token breakdown from AI SDK (v0.3.0) */
  tokenDetails?: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    reasoningTokens?: number;
  } | null;
  /** Estimated cost in USD for this call (v0.3.0) */
  cost?: number | null;
}
```

**Implementations:**
- `UnifiedLLMProvider` - All Vercel AI SDK providers (Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq, xAI, Azure, Cohere) through a single class with lazy dynamic imports
- `ClaudeCodeProvider` - Claude Code SDK (uses `claude` CLI subprocess)

### Generators

#### ServerGenerator

Generates TypeScript MCP server code using Handlebars templates.

```typescript
class ServerGenerator {
  generateServer(
    name: string,
    specs: ToolSpec[],
    impls: Record<string, string>,
    options?: { resourceSpecs?: ResourceSpec[]; promptSpecs?: PromptSpec[] }
  ): string;
  generatePackageJson(name: string, specs: ToolSpec[]): string;
  generateDockerfile(specs: ToolSpec[]): string;
  generateGitHubActions(name: string): string;
  generateTsConfig(): string;
  generateServerJson(name: string, specs: ToolSpec[]): string;
}
```

#### DocsGenerator

Generates documentation files.

```typescript
class DocsGenerator {
  generateReadme(name: string, specs: ToolSpec[]): string;
  generateSkill(name: string, specs: ToolSpec[]): string;
  generateChangelog(name: string, specs: ToolSpec[], version: string): string;
  generateToolsSpec(name: string, specs: ToolSpec[]): string;
  generateApiDocsIndex(name: string, specs: ToolSpec[]): string;
}
```

#### TestsGenerator

Generates test files.

```typescript
class TestsGenerator {
  generateTestFile(name: string, specs: ToolSpec[]): string;
}
```

### Parsers

#### OpenAPIServerGenerator

Parses OpenAPI specs and generates server code.

```typescript
class OpenAPIServerGenerator {
  constructor(spec: object, baseUrl?: string);
  generateServerCode(name: string): string;
  getToolSpecs(): ToolSpec[];
  getAuthEnvVars(): string[];
}
```

#### DatabaseServerGenerator

Introspects databases and generates CRUD tools.

```typescript
class DatabaseServerGenerator {
  constructor(connectionString: string);
  async introspect(tables?: string[]): Promise<void>;
  generateServerCode(name: string): string;
  getToolSpecs(): ToolSpec[];
}
```

#### GraphQLServerGenerator

Parses GraphQL SDL schemas and generates MCP servers. Query fields become read-only tools, mutation fields become write tools.

```typescript
class GraphQLServerGenerator {
  constructor(schemaString: string, endpoint?: string);
  generateServerCode(name: string): string;
  getToolSpecs(): ToolSpec[];
  getAuthEnvVars(): string[];  // GRAPHQL_ENDPOINT, GRAPHQL_AUTH_TOKEN
}
```

**Mapping rules:**
- Each `Query` field becomes a read-only tool (e.g., `getUser` -> `get_user`)
- Each `Mutation` field becomes a write tool (e.g., `createUser` -> `create_user`)
- GraphQL scalar types map to Zod schemas (`String` -> `z.string()`, `Int` -> `z.number()`, etc.)
- Field arguments become tool input parameters
- Requires the `graphql` npm package (dynamically imported)

#### OntologyParser

Multi-format ontology parser supporting RDF/OWL (Turtle), JSON-LD, and custom YAML.

```typescript
class OntologyParser {
  async parse(content: string, format?: 'rdf' | 'jsonld' | 'yaml'): Promise<OntologyDefinition>;
  async parseRDF(content: string): Promise<OntologyDefinition>;    // requires 'n3' package
  parseJsonLD(content: string): OntologyDefinition;
  async parseYAML(content: string): Promise<OntologyDefinition>;   // requires 'js-yaml' package
}
```

Auto-detection order: JSON-LD (starts with `{`/`[` + has `@context`/`@graph`), YAML (has `name:` or `classes:` lines), then RDF/Turtle.

#### OntologyServerGenerator

Generates MCP servers with CRUD tools and relationship tools from ontology definitions.

```typescript
class OntologyServerGenerator {
  constructor(definition: OntologyDefinition);
  generateServerCode(name: string): string;
  getToolSpecs(): ToolSpec[];
  getResourceSpecs(): Array<{ uri: string; name: string; description: string; mimeType: string }>;
}
```

**Mapping rules:**
- Each ontology class becomes 5 CRUD tools: `create_<class>`, `get_<class>`, `update_<class>`, `delete_<class>`, `list_<class>`
- Each object property becomes a relationship tool: `link_<source>_<relation>`
- Data properties become Zod-validated input parameters on create/update tools
- Pre-defined individuals are seeded into in-memory stores
- Each class is exposed as an MCP resource (`ontology://<className>`)

## Data Flow

### Generation from Description

```
User Description
      │
      ▼
┌──────────────────────┐
│ Extract Tool Specs   │ ← LLM call with EXTRACT_TOOLS_PROMPT
├──────────────────────┤
│ Extract Resources    │ ← LLM call with EXTRACT_RESOURCES_PROMPT
├──────────────────────┤
│ Extract Prompts      │ ← LLM call with EXTRACT_PROMPTS_PROMPT
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Generate             │ ← LLM calls with GENERATE_IMPLEMENTATION_PROMPT
│ Implementations      │   (parallel: up to maxConcurrency concurrent calls)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Generate Server Code │ ← Handlebars templates (tools + resources + prompts)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Generate Artifacts   │ ← Tests, Docs, Dockerfile, CI, CHANGELOG, server.json
└──────────┬───────────┘
           │
           ▼
     GeneratedServer
```

### Generation from OpenAPI

```
OpenAPI Spec
      │
      ▼
┌─────────────────┐
│ Parse Spec      │ ← Extract paths, operations, schemas
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract Auth    │ ← Security schemes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Tools  │ ← One tool per operation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate        │ ← Handlebars templates
│ Server Code     │
└────────┬────────┘
         │
         ▼
   GeneratedServer
```

### Generation from Database

```
Database Connection
      │
      ▼
┌─────────────────┐
│ Introspect      │ ← Query schema tables
│ Schema          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Extract         │ ← Columns, types, keys
│ Table Info      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate CRUD   │ ← 5 tools per table
│ Tools           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate        │ ← Handlebars templates
│ Server Code     │
└────────┬────────┘
         │
         ▼
   GeneratedServer
```

### Generation from GraphQL

```
GraphQL SDL Schema
      │
      ▼
┌───────────────────────┐
│ Parse SDL             │ ← graphql.parse() extracts type definitions
│ (Query + Mutation)    │
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Extract Fields        │ ← Query fields → read tools
│                       │   Mutation fields → write tools
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Map Types             │ ← GraphQL scalars → Zod schemas
│                       │   Arguments → tool input parameters
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Generate Server Code  │ ← Inline code generation (no LLM needed)
│ + graphqlRequest()    │   Includes fetch-based GraphQL client
└──────────┬────────────┘
           │
           ▼
     GeneratedServer
```

### Generation from Ontology

```
Ontology Content (RDF/OWL, JSON-LD, or YAML)
      │
      ▼
┌───────────────────────┐
│ Auto-detect Format    │ ← JSON-LD → YAML → RDF/Turtle
│ OntologyParser.parse()│
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Extract Classes       │ ← owl:Class / rdfs:Class
│ + Properties          │   Data properties + Object properties
│ + Individuals         │   Pre-defined instances
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Generate CRUD Tools   │ ← 5 tools per class (create/get/update/delete/list)
│ + Relationship Tools  │   link_<source>_<relation> per object property
│ + Resources           │   ontology://<className> per class
└──────────┬────────────┘
           │
           ▼
┌───────────────────────┐
│ Generate Server Code  │ ← Inline code generation (no LLM needed)
│ + In-memory Stores    │   Pre-populated with individuals
└──────────┬────────────┘
           │
           ▼
     GeneratedServer
```

## Module Structure

```
src/
├── agent/              # Main ToolFactoryAgent
│   ├── agent.ts        # Core agent class
│   └── index.ts        # Exports
│
├── providers/          # LLM Providers (v0.3.0: Vercel AI SDK)
│   ├── base.ts         # Abstract provider with caching + LLMResponse
│   ├── llm-provider.ts # UnifiedLLMProvider (all AI SDK providers)
│   ├── claude-code.ts  # Claude Code OAuth provider
│   ├── factory.ts      # Provider auto-detection factory
│   └── index.ts        # Exports
│
├── generators/         # Code Generators
│   ├── server.ts       # Server code generator
│   ├── docs.ts         # Documentation generator (README, skill, changelog, API docs)
│   ├── tests.ts        # Test generator
│   └── index.ts        # Exports
│
├── templates/          # Handlebars Templates
│   ├── server.ts.hbs   # Server template (tools + resources + prompts)
│   ├── test.spec.ts.hbs
│   ├── package.json.hbs
│   ├── Dockerfile.hbs
│   ├── github-actions.yml.hbs
│   ├── tsconfig.server.json.hbs
│   └── server.json.hbs
│
├── openapi/            # OpenAPI Parser
│   ├── generator.ts    # OpenAPI → MCP tools
│   └── index.ts        # Exports
│
├── database/           # Database Introspection
│   ├── generator.ts    # DB → CRUD tools
│   ├── introspector.ts # Schema introspection
│   └── index.ts        # Exports
│
├── graphql/            # GraphQL SDL Parser (v0.2.0)
│   ├── generator.ts    # GraphQL SDL → MCP tools
│   └── index.ts        # Exports
│
├── ontology/           # Ontology Parser (v0.2.0)
│   ├── types.ts        # OntologyDefinition, OntologyClass, OntologyProperty
│   ├── parser.ts       # Multi-format parser (RDF/OWL, JSON-LD, YAML)
│   ├── generator.ts    # Ontology → CRUD tools + resources
│   └── index.ts        # Exports
│
├── cache/              # LLM Response Cache (v0.2.0)
│   └── index.ts        # LLMCache with TTL, statistics, eviction
│
├── models/             # Data Models
│   ├── tool-spec.ts    # Tool specification
│   ├── resource-spec.ts # Resource specification (v0.2.0)
│   ├── prompt-spec.ts  # Prompt specification (v0.2.0)
│   ├── generated-server.ts
│   ├── generation-log.ts
│   ├── input-type.ts   # Input type enum
│   ├── validation-result.ts
│   └── index.ts        # Exports
│
├── validation/         # Code Validation
│   ├── parser.ts       # Response parsing
│   ├── schemas.ts      # Zod schemas
│   ├── registry.ts     # Validation registry
│   └── index.ts        # Exports
│
├── prompts/            # LLM Prompts
│   └── prompts.ts      # System/user prompts (tools, resources, prompts extraction)
│
├── config/             # Configuration
│   ├── config.ts       # Factory config
│   ├── providers.ts    # Provider enum, model lists, defaults
│   ├── pricing.ts      # Model pricing table, calculateCost() (v0.3.0)
│   └── index.ts        # Exports
│
├── cli/                # Command Line Interface
│   └── index.ts        # CLI entry point
│
├── server/             # MCP Server Mode
│   └── index.ts        # Factory-as-MCP-server (generate_mcp_server, etc.)
│
├── auth/               # OAuth2 Support
├── web-search/         # Web Search Integration
├── production/         # Production Code Generation
├── security/           # Security Scanning
├── middleware/         # Validation Middleware
├── observability/      # Telemetry/Tracing
├── execution-logger/   # Execution Logging
└── utils/              # Utilities
```

## Key Classes

### GeneratedServer

```typescript
interface GeneratedServer {
  name: string;
  serverCode: string;           // Main TypeScript code
  toolSpecs: ToolSpec[];        // Tool specifications
  resourceSpecs: ResourceSpec[]; // Resource specifications (v0.2.0)
  promptSpecs: PromptSpec[];    // Prompt specifications (v0.2.0)
  testCode: string;             // Test file
  dockerfile: string;           // Container config
  readme: string;               // Documentation
  skillFile: string;            // Claude Code skill
  packageJson: string;          // Dependencies
  tsconfigJson: string;         // TypeScript config
  githubActions: string;        // CI/CD workflow
  serverJson: string;           // MCP Registry manifest
  changelog: string;            // CHANGELOG.md
  toolsSpec: string;            // docs/tools.json - machine-readable API spec
  apiDocsIndex: string;         // docs/index.md - API documentation entry
  executionLog?: GenerationLog;
}
```

### ToolSpec

```typescript
interface ToolSpec {
  name: string;              # Tool name (snake_case)
  description: string;       # Tool description
  inputSchema: JsonSchema;   # Input parameters
  outputSchema?: JsonSchema; # Output schema
  implementationHints?: string;
  dependencies: string[];    # npm packages
}
```

### ResourceSpec

```typescript
interface ResourceSpec {
  uri: string;          // Resource URI (e.g., "db://users", "ontology://person")
  name: string;         // Human-readable name
  description: string;  // Description of the resource
  mimeType: string;     // MIME type (default: "application/json")
  template: boolean;    // Whether the URI contains {placeholders}
}
```

### PromptSpec

```typescript
interface PromptSpec {
  name: string;              // Prompt name in snake_case
  description: string;       // Description of what the prompt does
  arguments: PromptArgument[]; // Arguments the prompt accepts
  template: string;          // Template text (can reference arguments with ${argName})
}

interface PromptArgument {
  name: string;        // Argument name
  description: string; // Description
  required: boolean;   // Whether the argument is required
}
```

### FactoryConfig

```typescript
interface FactoryConfig {
  provider: LLMProvider;     # LLM provider
  model: string;             # Model name
  apiKey: string;            # API key
  maxTokens: number;         # Max output tokens
  temperature: number;       # Sampling temperature
}
```

### ProductionConfig

```typescript
interface ProductionConfig {
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logJson?: boolean;
  enableMetrics?: boolean;
  metricsPort?: number;
  enableRateLimiting?: boolean;
  rateLimitRequests?: number;
  rateLimitWindowSeconds?: number;
  enableRetries?: boolean;
  maxRetries?: number;
  retryBaseDelay?: number;
}
```

### GenerateOptions

```typescript
interface GenerateOptions {
  serverName?: string;
  description?: string;
  githubUsername?: string;
  version?: string;
  webSearch?: boolean;               // Search web for API documentation context
  authEnvVars?: string[];            // Environment variables for authentication
  includeHealthCheck?: boolean;
  productionConfig?: ProductionConfig;
  parallel?: boolean;                // Enable parallel tool generation (default: true)
  maxConcurrency?: number;           // Max concurrent LLM calls (default: 5)
  skipCache?: boolean;               // Bypass LLM response cache
  stream?: boolean;                  // Enable streaming output
  onStreamToken?: (token: string) => void; // Streaming callback
  budget?: number;                   // Max spend in USD (v0.3.0)
}
```

## LLM Response Cache

The cache module (`src/cache/`) provides in-memory caching with TTL-based expiration to avoid redundant LLM API calls.

```typescript
class LLMCache {
  constructor(config?: Partial<CacheConfig>);
  get(params: CacheKeyParams): CacheEntry | null;
  set(params: CacheKeyParams, text: string, metadata?: object): void;
  has(params: CacheKeyParams): boolean;
  invalidate(params: CacheKeyParams): boolean;
  clear(): void;
  prune(): number;             // Remove expired entries
  getStats(): CacheStats;     // Hit/miss rate, size, eviction counts
}
```

**Configuration:**
- `ttlMs` - Time-to-live per entry (default: 1 hour)
- `maxEntries` - Maximum cache size (default: 1000)
- `includeModelInKey` - Include model name in cache key (default: true)
- `includeTemperatureInKey` - Include temperature in cache key (default: true)

Cache keys are SHA-256 hashes of `systemPrompt | userPrompt | maxTokens | model | temperature`.

## Extension Points

### Custom LLM Providers

```typescript
class CustomProvider extends BaseLLMProvider {
  async call(system: string, user: string, maxTokens: number) {
    // Custom implementation
    return { text: '...', latencyMs: 100 };
  }
}
```

### Custom Templates

Templates use Handlebars. Add custom helpers:

```typescript
Handlebars.registerHelper('customHelper', (value) => {
  return transformValue(value);
});
```

### Custom Validators

```typescript
import { validateTypeScriptCode } from 'mcp-tool-factory';

const result = await validateTypeScriptCode(code);
if (!result.valid) {
  console.error(result.errors);
}
```

## Execution Logging

Generation creates detailed execution logs with cost tracking (v0.3.0):

```typescript
interface GenerationLog {
  serverName: string;
  provider: string;
  model: string;
  startTime: string;
  endTime: string;
  steps: GenerationStep[];
  toolsGenerated: string[];
  dependenciesUsed: string[];
  webSearchEnabled: boolean;
  // Cost tracking (v0.3.0)
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  llmCallCount: number;
  costBreakdown: Array<{ phase: string; cost: number; calls: number }>;
}

interface GenerationStep {
  type: string;
  timestamp: string;
  message: string;
  input?: string;
  output?: string;
}
```

### Cost Tracking Architecture (v0.3.0)

```
LLM Call → AI SDK usage → calculateCost() → LLMResponse.cost
                                                    │
                                                    ▼
                                          ExecutionLogger
                                          ├── totalCost accumulator
                                          ├── costByPhase tracker
                                          └── per-call cost in RawLLMCall
                                                    │
                                                    ▼
                                          GenerationLog
                                          ├── totalCost
                                          ├── costBreakdown (per phase)
                                          └── Markdown/JSON output
```

Phases tracked: `tool_extraction`, `resource_extraction`, `prompt_extraction`, `implementation`, `test_generation`, `docs_generation`.

## Security Architecture

### Input Validation

- All tool inputs validated with Zod schemas
- SQL injection prevention in database tools
- XSS prevention in generated code

### Output Validation

- TypeScript syntax validation
- Bracket matching fallback
- Schema compliance checking

### Security Scanning

```typescript
import { scanCode, SecurityIssue } from 'mcp-tool-factory';

const issues: SecurityIssue[] = await scanCode(serverCode);
```

## Performance Considerations

### LLM Optimization

- Minimal prompt tokens
- LLM response caching with configurable TTL (avoids redundant API calls)
- Parallel implementation generation (enabled by default, up to `maxConcurrency` concurrent calls)
- Streaming output with `onStreamToken` callback for real-time feedback
- Cost tracking with budget limits to prevent overspending (v0.3.0)
- Unified provider via Vercel AI SDK — lazy dynamic imports (v0.3.0)

### Template Optimization

- Pre-compiled Handlebars templates
- Minimal runtime overhead

### Bundle Optimization

- Tree-shaking enabled
- External dependencies (LLM SDKs, pg, sqlite3)
- TypeScript as optional external
- Optional dependencies loaded dynamically (`graphql`, `n3`, `js-yaml`)

## Testing Architecture

```
tests/
├── unit/               # Unit tests
│   ├── providers/
│   ├── generators/
│   └── validation/
├── integration/        # Integration tests
│   ├── agent.test.ts
│   └── cli.test.ts
└── e2e/               # End-to-end tests
    └── generation.test.ts
```

## Deployment

### npm Package

```bash
npm publish --access public
```

### MCP Registry

Uses generated `server.json`:

```bash
mcp-publisher publish
```

## Future Architecture

- **Plugins**: Extensible plugin system for custom generators and parsers
- **Persistent Cache**: File-based or Redis-backed LLM response cache
- **Incremental Generation**: Re-generate only changed tools when input evolves
- **Schema Composition**: Combine multiple input sources (e.g., OpenAPI + Ontology) into a single server
- **Cost History**: Persistent cost tracking across sessions for usage analytics
