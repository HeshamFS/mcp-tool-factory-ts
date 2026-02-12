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
  LLMCache,
  GraphQLServerGenerator,
  OntologyParser,
  OntologyServerGenerator,
  // Cost tracking (v0.3.0)
  MODEL_PRICING,
  calculateCost,
  formatCost,
  estimateCost,
  BudgetExceededError,
} from '@heshamfsalama/mcp-tool-factory';
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
  description?: string;
  githubUsername?: string;
  version?: string;
  webSearch?: boolean;
  authEnvVars?: string[];
  includeHealthCheck?: boolean;
  productionConfig?: ProductionConfig;
  /** Enable parallel generation of tool implementations (default: true) */
  parallel?: boolean;
  /** Maximum concurrent LLM calls when parallel is enabled (default: 5) */
  maxConcurrency?: number;
  /** Skip the LLM response cache (default: false) */
  skipCache?: boolean;
  /** Enable streaming output from LLM calls */
  stream?: boolean;
  /** Callback for streaming tokens */
  onStreamToken?: (token: string) => void;
  /** Maximum spend in USD — aborts with BudgetExceededError if exceeded */
  budget?: number;
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
    description?: string;
    githubUsername?: string;
    version?: string;
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
    description?: string;
    githubUsername?: string;
    version?: string;
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

#### generateFromGraphQL

Generate server from a GraphQL SDL schema.

```typescript
async generateFromGraphQL(
  schemaString: string,
  options?: {
    endpoint?: string;
    serverName?: string;
    description?: string;
    githubUsername?: string;
    version?: string;
  }
): Promise<GeneratedServer>
```

##### Example

```typescript
import { readFileSync } from 'fs';

const schema = readFileSync('./schema.graphql', 'utf-8');

const server = await agent.generateFromGraphQL(schema, {
  serverName: 'my-graphql-server',
  endpoint: 'https://api.example.com/graphql',
});
```

#### generateFromOntology

Generate server from an ontology definition (RDF/OWL, JSON-LD, or custom YAML).

```typescript
async generateFromOntology(
  content: string,
  options?: {
    format?: 'rdf' | 'jsonld' | 'yaml';
    serverName?: string;
    description?: string;
    githubUsername?: string;
    version?: string;
  }
): Promise<GeneratedServer>
```

##### Example

```typescript
import { readFileSync } from 'fs';

// RDF/OWL Turtle
const ontology = readFileSync('./domain.ttl', 'utf-8');
const server = await agent.generateFromOntology(ontology, {
  format: 'rdf',
  serverName: 'domain-server',
});

// YAML ontology
const yamlOntology = readFileSync('./domain.yaml', 'utf-8');
const server2 = await agent.generateFromOntology(yamlOntology, {
  format: 'yaml',
  serverName: 'yaml-domain-server',
});
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
| `resourceSpecs` | `ResourceSpec[]` | List of resource specifications |
| `promptSpecs` | `PromptSpec[]` | List of prompt specifications |
| `testCode` | `string` | Test file content |
| `dockerfile` | `string` | Dockerfile content |
| `readme` | `string` | README content |
| `skillFile` | `string` | Claude Code skill file |
| `packageJson` | `string` | package.json content |
| `tsconfigJson` | `string` | tsconfig.json content |
| `githubActions` | `string` | GitHub Actions workflow |
| `serverJson` | `string` | MCP Registry manifest |
| `changelog` | `string` | CHANGELOG.md content |
| `toolsSpec` | `string` | Machine-readable API spec (docs/tools.json) |
| `apiDocsIndex` | `string` | API documentation entry point (docs/index.md) |
| `executionLog` | `GenerationLog \| null` | Generation trace |

### Example

```typescript
const server = await agent.generateFromDescription('...');

console.log(server.name);           // 'GeneratedToolServer'
console.log(server.toolSpecs);      // [{ name: 'tool1', ... }]
console.log(server.resourceSpecs);  // [{ uri: 'resource://...', ... }]
console.log(server.promptSpecs);    // [{ name: 'prompt1', ... }]
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
import { writeServerToDirectory } from '@heshamfsalama/mcp-tool-factory';

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
import { getDefaultConfig, LLMProvider } from '@heshamfsalama/mcp-tool-factory';

const config = getDefaultConfig();
// { provider: LLMProvider.ANTHROPIC, model: 'claude-sonnet-4-5-20250929', ... }

const customConfig = {
  ...config,
  provider: LLMProvider.OPENAI,
  model: 'gpt-5.2',
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
  MISTRAL = 'mistral',
  DEEPSEEK = 'deepseek',
  GROQ = 'groq',
  XAI = 'xai',
  AZURE = 'azure',
  COHERE = 'cohere',
  CLAUDE_CODE = 'claude_code',
}
```

### Example

```typescript
import { LLMProvider } from '@heshamfsalama/mcp-tool-factory';

const config = {
  provider: LLMProvider.ANTHROPIC,
  model: 'claude-opus-4-6',
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
import { validateTypeScriptCode, validateGeneratedServer } from '@heshamfsalama/mcp-tool-factory';

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
import { DatabaseServerGenerator, DatabaseType } from '@heshamfsalama/mcp-tool-factory';

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
import { OpenAPIServerGenerator } from '@heshamfsalama/mcp-tool-factory';

const generator = new OpenAPIServerGenerator(openapiSpec, 'https://api.example.com');
const serverCode = generator.generateServerCode('MyAPIServer');
const toolSpecs = generator.getToolSpecs();
const authEnvVars = generator.getAuthEnvVars();
```

---

## ResourceSpec

Resource specification for MCP resources exposed by a generated server.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `uri` | `string` | Resource URI (e.g., `resource://users/{id}`) |
| `name` | `string` | Human-readable name |
| `description` | `string` | Resource description |
| `mimeType` | `string` | MIME type of the resource |
| `template` | `boolean` | Whether the URI is a template with parameters |

### Example

```typescript
import { type ResourceSpec } from '@heshamfsalama/mcp-tool-factory';

const resource: ResourceSpec = {
  uri: 'resource://users/{id}',
  name: 'User Profile',
  description: 'Get user profile by ID',
  mimeType: 'application/json',
  template: true,
};
```

---

## PromptSpec

Prompt specification for MCP prompts exposed by a generated server.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Prompt name |
| `description` | `string` | Prompt description |
| `arguments` | `PromptArgument[]` | Prompt arguments |
| `template` | `string` | Prompt template string |

### PromptArgument

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Argument name |
| `description` | `string` | Argument description |
| `required` | `boolean` | Whether the argument is required |

### Example

```typescript
import { type PromptSpec } from '@heshamfsalama/mcp-tool-factory';

const prompt: PromptSpec = {
  name: 'summarize_data',
  description: 'Summarize data from a given table',
  arguments: [
    { name: 'table', description: 'Table name', required: true },
    { name: 'format', description: 'Output format', required: false },
  ],
  template: 'Summarize all data from the {{table}} table in {{format}} format.',
};
```

---

## GraphQL Module

### GraphQLServerGenerator

Generate an MCP server from a GraphQL SDL schema. Maps queries to read-only tools and mutations to write tools.

```typescript
import { GraphQLServerGenerator } from '@heshamfsalama/mcp-tool-factory';

const generator = new GraphQLServerGenerator(schemaString, 'https://api.example.com/graphql');
const serverCode = generator.generateServerCode('MyGraphQLServer');
const toolSpecs = generator.getToolSpecs();
const authEnvVars = generator.getAuthEnvVars();
```

---

## Ontology Module

### OntologyParser

Parse ontology files in RDF/OWL (Turtle), JSON-LD, or custom YAML format.

```typescript
import { OntologyParser, type OntologyDefinition } from '@heshamfsalama/mcp-tool-factory';

const parser = new OntologyParser();
const definition: OntologyDefinition = await parser.parse(content, 'rdf');
```

### OntologyServerGenerator

Generate an MCP server from a parsed ontology definition. Creates CRUD tools for each class and relationship tools for object properties.

```typescript
import { OntologyServerGenerator } from '@heshamfsalama/mcp-tool-factory';

const generator = new OntologyServerGenerator(definition);
const serverCode = generator.generateServerCode('MyOntologyServer');
const toolSpecs = generator.getToolSpecs();
```

### OntologyDefinition

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Ontology name |
| `description` | `string` | Human-readable description |
| `classes` | `OntologyClass[]` | Classes defined in the ontology |
| `properties` | `OntologyProperty[]` | All properties (data and object) |
| `individuals` | `OntologyIndividual[]` | Pre-defined individuals for seeding data |

### OntologyClass

| Property | Type | Description |
|----------|------|-------------|
| `uri` | `string` | Full URI of the class |
| `label` | `string` | Human-readable label |
| `description` | `string` | Class description |
| `superClass` | `string \| undefined` | Parent class URI |
| `dataProperties` | `OntologyProperty[]` | Literal-valued properties |
| `objectProperties` | `OntologyProperty[]` | Relationship properties |

### OntologyProperty

| Property | Type | Description |
|----------|------|-------------|
| `uri` | `string` | Full URI of the property |
| `label` | `string` | Human-readable label |
| `description` | `string` | Property description |
| `domain` | `string \| undefined` | Class this property belongs to |
| `range` | `string` | Value type or class URI |
| `type` | `'data' \| 'object'` | Data property or object relationship |

---

## Cache Module

### LLMCache

In-memory cache for LLM responses with TTL-based expiration and LRU eviction.

```typescript
import { LLMCache, type CacheConfig } from '@heshamfsalama/mcp-tool-factory';

const cache = new LLMCache({ ttlMs: 3600000, maxEntries: 500 });

// Check cache
const cached = cache.get({ systemPrompt, userPrompt, maxTokens: 4096 });
if (cached) {
  return cached.text;
}

// Store in cache
cache.set(
  { systemPrompt, userPrompt, maxTokens: 4096 },
  response.text,
  { tokensIn: response.tokensIn, tokensOut: response.tokensOut }
);

// Get statistics
const stats = cache.getStats();
console.log(`Hit rate: ${stats.hitRate}%, Size: ${stats.size}`);

// Clear cache
cache.clear();
```

### CacheConfig

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| `enabled` | `boolean` | Enable/disable caching | `true` |
| `ttlMs` | `number` | Time-to-live in milliseconds | `3600000` (1 hour) |
| `maxEntries` | `number` | Maximum cache entries | `1000` |
| `includeModelInKey` | `boolean` | Include model in cache key | `true` |
| `includeTemperatureInKey` | `boolean` | Include temperature in cache key | `true` |

### Global Cache

```typescript
import { getGlobalCache, resetGlobalCache } from '@heshamfsalama/mcp-tool-factory';

// Get or create shared cache instance
const cache = getGlobalCache({ ttlMs: 1800000 });

// Reset the global cache
resetGlobalCache();
```

---

## Cost Tracking

### MODEL_PRICING

Static pricing table for 50+ models across all supported providers.

```typescript
import { MODEL_PRICING, type ModelPricing } from '@heshamfsalama/mcp-tool-factory';

const pricing: ModelPricing = MODEL_PRICING['claude-sonnet-4-5-20250929'];
// { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.30, cacheWritePer1M: 3.75 }
```

### calculateCost

Calculate the estimated cost for an LLM call.

```typescript
import { calculateCost, type CostBreakdown } from '@heshamfsalama/mcp-tool-factory';

const cost: CostBreakdown | null = calculateCost(
  'claude-sonnet-4-5-20250929',
  10000,  // input tokens
  5000,   // output tokens
  { cacheReadTokens: 2000 }  // optional token details
);
// { total: 0.0993, input: 0.024, output: 0.075, cacheRead: 0.0006 }
```

### formatCost

Format a cost value as a human-readable string.

```typescript
import { formatCost } from '@heshamfsalama/mcp-tool-factory';

formatCost(0.1234);  // "$0.1234"
formatCost(0.005);   // "<$0.01"
formatCost(0);       // "$0.00"
```

### estimateCost

Estimate cost for a generation before making API calls.

```typescript
import { estimateCost } from '@heshamfsalama/mcp-tool-factory';

const cost = estimateCost('gpt-5.2', 15000, 10000);
// 0.11 (USD)
```

### BudgetExceededError

Thrown when cumulative cost exceeds the `budget` option.

```typescript
import { ToolFactoryAgent, BudgetExceededError } from '@heshamfsalama/mcp-tool-factory';

try {
  const server = await agent.generateFromDescription('...', {
    budget: 0.50,  // Max $0.50
  });
} catch (error) {
  if (error instanceof BudgetExceededError) {
    console.log(`Budget exceeded: ${error.message}`);
  }
}
```

---

## Complete Example

```typescript
import {
  ToolFactoryAgent,
  writeServerToDirectory,
  validateGeneratedServer,
  formatCost,
  LLMProvider,
} from '@heshamfsalama/mcp-tool-factory';

async function main() {
  // Create agent with explicit configuration
  const agent = new ToolFactoryAgent({
    config: {
      provider: LLMProvider.ANTHROPIC,
      model: 'claude-sonnet-4-5-20250929',
    },
  });

  // Generate server with all features
  const server = await agent.generateFromDescription(
    'Create tools for a personal finance tracker: add transactions, get balance, list transactions by category, generate monthly reports',
    {
      serverName: 'finance-tracker',
      webSearch: true,
      budget: 2.00,  // Abort if cost exceeds $2.00
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

  // Show cost
  if (server.executionLog) {
    console.log(`Total cost: ${formatCost(server.executionLog.totalCost)}`);
  }
}

main().catch(console.error);
```
