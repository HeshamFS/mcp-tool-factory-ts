# API Reference

Complete TypeScript API documentation for MCP Tool Factory.

## Overview

```typescript
import {
  ToolFactoryAgent,
  writeServerToDirectory,
  validateGeneratedServer,
  LLMProvider,
  getDefaultConfig,
} from 'mcp-tool-factory';
```

---

## ToolFactoryAgent

Main agent class for generating MCP servers.

### Constructor

```typescript
new ToolFactoryAgent(options?: {
  config?: Partial<FactoryConfig>;
  apiKey?: string;
  model?: string;
  requireLlm?: boolean;
})
```

#### Parameters

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `config` | `Partial<FactoryConfig>` | Configuration object | Auto-detect |
| `apiKey` | `string` | API key (overrides config) | From env |
| `model` | `string` | Model to use | Provider default |
| `requireLlm` | `boolean` | Require LLM for init | `true` |

#### Example

```typescript
// Auto-detect from environment
const agent = new ToolFactoryAgent();

// Explicit API key
const agent = new ToolFactoryAgent({
  apiKey: 'sk-ant-api03-...',
});

// Full configuration
const agent = new ToolFactoryAgent({
  config: {
    provider: LLMProvider.ANTHROPIC,
    model: 'claude-sonnet-4-20250514',
    apiKey: 'sk-ant-api03-...',
    maxTokens: 4096,
    temperature: 0,
  },
});

// No LLM required (for OpenAPI/database)
const agent = new ToolFactoryAgent({ requireLlm: false });
```

### Methods

#### generateFromDescription

Generate server from natural language.

```typescript
async generateFromDescription(
  description: string,
  options?: GenerateOptions
): Promise<GeneratedServer>
```

##### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `description` | `string` | Natural language description |
| `options` | `GenerateOptions` | Generation options |

##### GenerateOptions

```typescript
interface GenerateOptions {
  serverName?: string;
  webSearch?: boolean;
  authEnvVars?: string[];
  includeHealthCheck?: boolean;
  productionConfig?: ProductionConfig;
}
```

##### Example

```typescript
const server = await agent.generateFromDescription(
  'Create tools for managing a todo list with priorities and due dates',
  {
    serverName: 'todo-server',
    webSearch: true,
    authEnvVars: ['TODO_API_KEY'],
    includeHealthCheck: true,
    productionConfig: {
      enableLogging: true,
      enableMetrics: true,
      enableRateLimiting: true,
      rateLimitRequests: 100,
      enableRetries: true,
    },
  }
);
```

#### generateFromOpenAPI

Generate server from OpenAPI specification.

```typescript
async generateFromOpenAPI(
  openapiSpec: Record<string, unknown>,
  options?: {
    baseUrl?: string;
    serverName?: string;
  }
): Promise<GeneratedServer>
```

##### Example

```typescript
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

const spec = yaml.load(readFileSync('./openapi.yaml', 'utf-8'));

const server = await agent.generateFromOpenAPI(spec, {
  serverName: 'my-api-server',
  baseUrl: 'https://api.example.com/v2',
});
```

#### generateFromDatabase

Generate server from database schema.

```typescript
async generateFromDatabase(
  databasePath: string,
  options?: {
    serverName?: string;
    tables?: string[];
  }
): Promise<GeneratedServer>
```

##### Example

```typescript
// SQLite
const server = await agent.generateFromDatabase('./data.db', {
  serverName: 'data-server',
  tables: ['users', 'posts'],
});

// PostgreSQL
const server = await agent.generateFromDatabase(
  'postgresql://user:pass@localhost/mydb',
  { serverName: 'postgres-server' }
);
```

---

## GeneratedServer

Output from the tool factory.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Server name |
| `serverCode` | `string` | Main server TypeScript code |
| `toolSpecs` | `ToolSpec[]` | List of tool specifications |
| `testCode` | `string` | Test file content |
| `dockerfile` | `string` | Dockerfile content |
| `readme` | `string` | README content |
| `skillFile` | `string` | Claude Code skill file |
| `packageJson` | `string` | package.json content |
| `tsconfigJson` | `string` | tsconfig.json content |
| `githubActions` | `string` | GitHub Actions workflow |
| `serverJson` | `string` | MCP Registry manifest |
| `executionLog` | `GenerationLog \| null` | Generation trace |

### Example

```typescript
const server = await agent.generateFromDescription('...');

console.log(server.name);           // 'GeneratedToolServer'
console.log(server.toolSpecs);      // [{ name: 'tool1', ... }]
console.log(server.serverCode);     // TypeScript code
```

---

## writeServerToDirectory

Write generated server to disk.

```typescript
async function writeServerToDirectory(
  server: GeneratedServer,
  outputPath: string
): Promise<void>
```

### Example

```typescript
import { writeServerToDirectory } from 'mcp-tool-factory';

await writeServerToDirectory(server, './servers/my-server');
```

### Output Structure

```
./servers/my-server/
├── src/
│   └── index.ts
├── tests/
│   └── tools.test.ts
├── package.json
├── tsconfig.json
├── Dockerfile
├── README.md
├── skill.md
├── server.json
├── EXECUTION_LOG.md
└── .github/
    └── workflows/
        └── ci.yml
```

---

## FactoryConfig

Configuration for the factory agent.

### Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `provider` | `LLMProvider` | LLM provider | Auto-detect |
| `model` | `string` | Model name | Provider default |
| `apiKey` | `string` | API key | From env |
| `maxTokens` | `number` | Max output tokens | `4096` |
| `temperature` | `number` | Sampling temperature | `0` |

### Example

```typescript
import { getDefaultConfig, LLMProvider } from 'mcp-tool-factory';

const config = getDefaultConfig();
// { provider: LLMProvider.ANTHROPIC, model: 'claude-sonnet-4-20250514', ... }

const customConfig = {
  ...config,
  provider: LLMProvider.OPENAI,
  model: 'gpt-4o',
};
```

---

## LLMProvider

Enum of supported LLM providers.

```typescript
enum LLMProvider {
  ANTHROPIC = 'anthropic',
  OPENAI = 'openai',
  GOOGLE = 'google',
  CLAUDE_CODE = 'claude_code',
}
```

### Example

```typescript
import { LLMProvider } from 'mcp-tool-factory';

const config = {
  provider: LLMProvider.ANTHROPIC,
  model: 'claude-opus-4-20250514',
};
```

---

## ProductionConfig

Configuration for production features.

### Properties

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `enableLogging` | `boolean` | Enable pino logging | `false` |
| `logLevel` | `string` | Log level | `'info'` |
| `logJson` | `boolean` | JSON log format | `false` |
| `enableMetrics` | `boolean` | Enable Prometheus metrics | `false` |
| `metricsPort` | `number` | Metrics server port | `9090` |
| `enableRateLimiting` | `boolean` | Enable rate limiting | `false` |
| `rateLimitRequests` | `number` | Requests per window | `100` |
| `rateLimitWindowSeconds` | `number` | Window duration | `60` |
| `enableRetries` | `boolean` | Enable retry logic | `false` |
| `maxRetries` | `number` | Max retry attempts | `3` |
| `retryBaseDelay` | `number` | Base delay (ms) | `1000` |

### Example

```typescript
const productionConfig: ProductionConfig = {
  enableLogging: true,
  logLevel: 'debug',
  logJson: true,
  enableMetrics: true,
  metricsPort: 9090,
  enableRateLimiting: true,
  rateLimitRequests: 100,
  rateLimitWindowSeconds: 60,
  enableRetries: true,
  maxRetries: 3,
  retryBaseDelay: 1000,
};
```

---

## ToolSpec

Tool specification model.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Tool name (snake_case) |
| `description` | `string` | Tool description |
| `inputSchema` | `JsonSchema` | Input parameters schema |
| `outputSchema` | `JsonSchema \| null` | Output schema |
| `implementationHints` | `string \| null` | Implementation notes |
| `dependencies` | `string[]` | npm dependencies |

### Example

```typescript
const toolSpec: ToolSpec = {
  name: 'get_weather',
  description: 'Get current weather for a city',
  inputSchema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' },
    },
    required: ['city'],
  },
  outputSchema: null,
  implementationHints: 'Use OpenWeatherMap API',
  dependencies: ['axios'],
};
```

---

## Validation Functions

### validateTypeScriptCode

Validate TypeScript syntax using the compiler.

```typescript
async function validateTypeScriptCode(code: string): Promise<{
  valid: boolean;
  errors: Array<{ line: number; column: number; message: string }>;
  error?: string;
}>
```

### validateGeneratedServer

Validate complete server code.

```typescript
async function validateGeneratedServer(serverCode: string): Promise<{
  valid: boolean;
  errors: Array<{ line: number; column: number; message: string }>;
  summary?: string;
}>
```

### Example

```typescript
import { validateTypeScriptCode, validateGeneratedServer } from 'mcp-tool-factory';

// Validate code snippet
const result = await validateTypeScriptCode(`
  const x: number = "not a number"; // Type error won't be caught
  function broken( { // Syntax error will be caught
`);
console.log(result);
// { valid: false, errors: [{ line: 3, column: 20, message: "')' expected." }] }

// Validate server
const serverResult = await validateGeneratedServer(server.serverCode);
console.log(serverResult.summary);
// 'Generated server code is syntactically valid'
```

---

## Database Module

### DatabaseServerGenerator

```typescript
import { DatabaseServerGenerator, DatabaseType } from 'mcp-tool-factory';

const generator = new DatabaseServerGenerator('./data.db');
await generator.introspect(['users', 'posts']);

const serverCode = generator.generateServerCode('MyServer');
const toolSpecs = generator.getToolSpecs();
```

### DatabaseType

```typescript
enum DatabaseType {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
}
```

---

## OpenAPI Module

### OpenAPIServerGenerator

```typescript
import { OpenAPIServerGenerator } from 'mcp-tool-factory';

const generator = new OpenAPIServerGenerator(openapiSpec, 'https://api.example.com');
const serverCode = generator.generateServerCode('MyAPIServer');
const toolSpecs = generator.getToolSpecs();
const authEnvVars = generator.getAuthEnvVars();
```

---

## Complete Example

```typescript
import {
  ToolFactoryAgent,
  writeServerToDirectory,
  validateGeneratedServer,
  LLMProvider,
} from 'mcp-tool-factory';

async function main() {
  // Create agent with explicit configuration
  const agent = new ToolFactoryAgent({
    config: {
      provider: LLMProvider.ANTHROPIC,
      model: 'claude-sonnet-4-20250514',
    },
  });

  // Generate server with all features
  const server = await agent.generateFromDescription(
    'Create tools for a personal finance tracker: add transactions, get balance, list transactions by category, generate monthly reports',
    {
      serverName: 'finance-tracker',
      webSearch: true,
      authEnvVars: ['FINANCE_API_KEY'],
      productionConfig: {
        enableLogging: true,
        enableMetrics: true,
        enableRateLimiting: true,
        rateLimitRequests: 60,
      },
    }
  );

  // Validate generated code
  const validation = await validateGeneratedServer(server.serverCode);
  if (!validation.valid) {
    console.error('Validation errors:', validation.errors);
    return;
  }

  // Write to disk
  await writeServerToDirectory(server, './servers/finance');

  console.log(`Generated ${server.toolSpecs.length} tools:`);
  server.toolSpecs.forEach(tool => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });
}

main().catch(console.error);
```
