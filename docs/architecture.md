# Architecture

System design and internal structure of MCP Tool Factory.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Tool Factory                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Natural   │  │   OpenAPI   │  │  Database   │              │
│  │  Language   │  │    Spec     │  │   Schema    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                 ToolFactoryAgent                      │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │       │
│  │  │ Anthropic│  │  OpenAI  │  │  Google  │            │       │
│  │  │ Provider │  │ Provider │  │ Provider │            │       │
│  │  └──────────┘  └──────────┘  └──────────┘            │       │
│  └──────────────────────────────────────────────────────┘       │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                    Generators                         │       │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐      │       │
│  │  │   Server   │  │    Docs    │  │   Tests    │      │       │
│  │  │ Generator  │  │ Generator  │  │ Generator  │      │       │
│  │  └────────────┘  └────────────┘  └────────────┘      │       │
│  └──────────────────────────────────────────────────────┘       │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                 GeneratedServer                       │       │
│  │  src/index.ts │ tests │ README │ Dockerfile │ CI/CD  │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
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
  async generateFromDescription(description: string): Promise<GeneratedServer>;
  async generateFromOpenAPI(spec: object): Promise<GeneratedServer>;
  async generateFromDatabase(path: string): Promise<GeneratedServer>;
}
```

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
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  error?: string;
}
```

**Implementations:**
- `AnthropicProvider` - Claude models
- `OpenAIProvider` - GPT models
- `GoogleProvider` - Gemini models
- `ClaudeCodeProvider` - Claude Code SDK

### Generators

#### ServerGenerator

Generates TypeScript MCP server code using Handlebars templates.

```typescript
class ServerGenerator {
  generateServer(name: string, specs: ToolSpec[], impls: Record<string, string>): string;
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

## Data Flow

### Generation from Description

```
User Description
      │
      ▼
┌─────────────────┐
│ Extract Tool    │ ← LLM call with EXTRACT_TOOLS_PROMPT
│ Specifications  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate        │ ← LLM call with GENERATE_IMPLEMENTATION_PROMPT
│ Implementations │   (one per tool)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate        │ ← Handlebars templates
│ Server Code     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate        │ ← Tests, Docs, Dockerfile, CI
│ Artifacts       │
└────────┬────────┘
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

## Module Structure

```
src/
├── agent/              # Main ToolFactoryAgent
│   ├── agent.ts        # Core agent class
│   └── index.ts        # Exports
│
├── providers/          # LLM Providers
│   ├── base.ts         # Abstract provider
│   ├── anthropic.ts    # Claude provider
│   ├── openai.ts       # GPT provider
│   ├── google.ts       # Gemini provider
│   ├── claude-code.ts  # Claude Code provider
│   ├── factory.ts      # Provider factory
│   └── index.ts        # Exports
│
├── generators/         # Code Generators
│   ├── server.ts       # Server code generator
│   ├── docs.ts         # Documentation generator
│   ├── tests.ts        # Test generator
│   └── index.ts        # Exports
│
├── templates/          # Handlebars Templates
│   ├── server.ts.hbs   # Server template
│   ├── test.spec.ts.hbs
│   ├── package.json.hbs
│   ├── Dockerfile.hbs
│   ├── github-actions.yml.hbs
│   ├── tsconfig.server.json.hbs
│   └── server.json.hbs
│
├── openapi/            # OpenAPI Parser
│   ├── generator.ts    # OpenAPI → MCP
│   └── index.ts        # Exports
│
├── database/           # Database Introspection
│   ├── generator.ts    # DB → CRUD tools
│   ├── introspector.ts # Schema introspection
│   └── index.ts        # Exports
│
├── models/             # Data Models
│   ├── tool-spec.ts    # Tool specification
│   ├── generated-server.ts
│   ├── generation-log.ts
│   └── index.ts        # Exports
│
├── validation/         # Code Validation
│   ├── parser.ts       # Response parsing
│   ├── schemas.ts      # Zod schemas
│   └── index.ts        # Exports
│
├── prompts/            # LLM Prompts
│   └── prompts.ts      # System/user prompts
│
├── config/             # Configuration
│   ├── config.ts       # Factory config
│   ├── providers.ts    # Provider enum
│   └── index.ts        # Exports
│
├── cli/                # Command Line Interface
│   └── index.ts        # CLI entry point
│
├── auth/               # OAuth2 Support
├── web-search/         # Web Search Integration
├── production/         # Production Features
├── security/           # Security Scanning
├── middleware/         # Validation Middleware
├── observability/      # Telemetry
├── execution-logger/   # Execution Logging
└── utils/              # Utilities
```

## Key Classes

### GeneratedServer

```typescript
interface GeneratedServer {
  name: string;
  serverCode: string;       // Main TypeScript code
  toolSpecs: ToolSpec[];    # Tool specifications
  testCode: string;         # Test file
  dockerfile: string;       # Container config
  readme: string;           # Documentation
  skillFile: string;        # Claude Code skill
  packageJson: string;      # Dependencies
  tsconfigJson: string;     # TypeScript config
  githubActions: string;    # CI/CD workflow
  serverJson: string;       # MCP Registry manifest
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

Generation creates detailed execution logs:

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
}

interface GenerationStep {
  type: string;
  timestamp: string;
  message: string;
  input?: string;
  output?: string;
}
```

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
- Cached tool specs
- Parallel implementation generation (future)

### Template Optimization

- Pre-compiled Handlebars templates
- Minimal runtime overhead

### Bundle Optimization

- Tree-shaking enabled
- External dependencies (LLM SDKs, pg, sqlite3)
- TypeScript as optional external

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

- **Parallel Generation**: Generate tool implementations concurrently
- **Streaming**: Stream generated code as it's produced
- **Caching**: Cache LLM responses for repeated patterns
- **Plugins**: Extensible plugin system for generators
