# MCP Tool Factory (TypeScript)

Generate production-ready MCP (Model Context Protocol) servers from natural language descriptions, OpenAPI specs, database schemas, GraphQL schemas, or ontologies.

[![npm version](https://img.shields.io/npm/v/@heshamfsalama/mcp-tool-factory.svg)](https://www.npmjs.com/package/@heshamfsalama/mcp-tool-factory)
[![npm downloads](https://img.shields.io/npm/dm/@heshamfsalama/mcp-tool-factory.svg)](https://www.npmjs.com/package/@heshamfsalama/mcp-tool-factory)
[![CI](https://github.com/HeshamFS/mcp-tool-factory-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/HeshamFS/mcp-tool-factory-ts/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Registry-purple.svg)](https://registry.modelcontextprotocol.io)

## Why MCP?

The **Model Context Protocol (MCP)** is an open standard that enables AI assistants to securely connect with external data sources and tools. MCP servers expose tools that can be used by:

- **Claude Code** and **Claude Desktop**
- **OpenAI Agents SDK**
- **Google ADK (Agent Development Kit)**
- **LangChain** and **CrewAI**
- Any MCP-compatible client

MCP Tool Factory lets you generate complete, production-ready MCP servers in seconds.

## Features

| Feature | Description |
|---------|-------------|
| **Natural Language** | Describe your tools in plain English |
| **OpenAPI Import** | Convert any REST API spec to MCP tools |
| **Database CRUD** | Generate tools from SQLite or PostgreSQL schemas |
| **GraphQL Import** | Convert GraphQL schemas to MCP tools (queries to reads, mutations to writes) |
| **Ontology Import** | Generate from RDF/OWL, JSON-LD, or YAML ontologies |
| **Resources & Prompts** | Full support for all three MCP primitives: Tools, Resources, and Prompts |
| **10 LLM Providers** | Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq, xAI, Azure, Cohere + Claude Code via Vercel AI SDK |
| **Cost Tracking** | Per-call cost calculation, budget limits, provider cost comparison |
| **Parallel Generation** | Tool implementations generated concurrently for faster output |
| **LLM Response Caching** | Deduplicates identical LLM calls with configurable TTL |
| **Streamable HTTP** | Generated servers use the modern Streamable HTTP transport |
| **Web Search** | Auto-fetch API documentation for better generation |
| **Production Ready** | Logging, metrics, rate limiting, retries built-in |
| **Type Safe** | Full TypeScript with strict mode |
| **MCP Registry** | Generates server.json for registry publishing |
| **Is an MCP Server** | Use it directly with Claude to generate servers on-the-fly |

## Use as MCP Server

MCP Tool Factory is itself an MCP server! Add it to Claude Desktop, Claude Code, Cursor, or VS Code to generate MCP servers through conversation.

### Tier 1 — Zero Config (Claude Code)

Claude Code auto-injects `CLAUDE_CODE_OAUTH_TOKEN` — no env vars needed:

```bash
claude mcp add mcp-tool-factory -- node /path/to/mcp-tool-factory-ts/bin/mcp-server.js
```

### Tier 2 — Standard (Pick a Provider)

Set one API key and go. The factory auto-detects the provider:

**Claude Desktop / Cursor / VS Code** — add to your MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, or `.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "mcp-tool-factory": {
      "command": "node",
      "args": ["/path/to/mcp-tool-factory-ts/bin/mcp-server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

Any of these API keys will work: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `DEEPSEEK_API_KEY`, `GROQ_API_KEY`, `XAI_API_KEY`, `AZURE_OPENAI_API_KEY`, `COHERE_API_KEY`.

### Tier 3 — Full Control (Provider + Model + Budget)

Use `MCP_FACTORY_PROVIDER`, `MCP_FACTORY_MODEL`, and `MCP_FACTORY_BUDGET` to override auto-detection:

```json
{
  "mcpServers": {
    "mcp-tool-factory": {
      "command": "node",
      "args": ["/path/to/mcp-tool-factory-ts/bin/mcp-server.js"],
      "env": {
        "OPENAI_API_KEY": "your-key-here",
        "MCP_FACTORY_PROVIDER": "openai",
        "MCP_FACTORY_MODEL": "gpt-5.2",
        "MCP_FACTORY_BUDGET": "0.50"
      }
    }
  }
}
```

| Env Var | Purpose | Example |
|---------|---------|---------|
| `MCP_FACTORY_PROVIDER` | Override auto-detected provider | `openai`, `groq`, `deepseek` |
| `MCP_FACTORY_MODEL` | Override default model | `gpt-5.2`, `deepseek-chat` |
| `MCP_FACTORY_BUDGET` | Per-generation budget limit in USD | `0.50` |

**Claude Code CLI with full control:**

```bash
claude mcp add mcp-tool-factory \
  -e DEEPSEEK_API_KEY=your-key \
  -e MCP_FACTORY_PROVIDER=deepseek \
  -e MCP_FACTORY_MODEL=deepseek-chat \
  -e MCP_FACTORY_BUDGET=0.25 \
  -- node /path/to/mcp-tool-factory-ts/bin/mcp-server.js
```

### Available Tools

| Tool | Description |
|------|-------------|
| `generate_mcp_server` | Generate from natural language description |
| `generate_from_openapi` | Generate from OpenAPI specification |
| `generate_from_database` | Generate from database schema |
| `generate_from_graphql` | Generate from GraphQL schema |
| `generate_from_ontology` | Generate from RDF/OWL, JSON-LD, or YAML ontology |
| `validate_typescript` | Validate TypeScript code |
| `list_providers` | List available LLM providers |
| `get_factory_info` | Get factory capabilities |

### Example Conversation

> **You:** Create an MCP server for the GitHub API with tools to list repos, create issues, and manage pull requests
>
> **Claude:** *Uses `generate_mcp_server` tool*
>
> I've generated a complete MCP server with the following tools:
> - `list_repositories` - List user repositories
> - `create_issue` - Create a new issue
> - `list_pull_requests` - List PRs for a repo
> - `merge_pull_request` - Merge a PR
>
> Let me write these files to your project...

## Quick Start

### Installation

```bash
# Global installation
npm install -g @heshamfsalama/mcp-tool-factory

# Or use npx
npx @heshamfsalama/mcp-tool-factory generate "Create tools for managing a todo list"
```

### Set Your API Key

At least one provider API key is required:

```bash
# Anthropic Claude (recommended)
export ANTHROPIC_API_KEY=your-key-here

# Or Claude Code OAuth
export CLAUDE_CODE_OAUTH_TOKEN=your-token-here

# Or any other supported provider
export OPENAI_API_KEY=your-key-here
export GOOGLE_API_KEY=your-key-here
export MISTRAL_API_KEY=your-key-here
export DEEPSEEK_API_KEY=your-key-here
export GROQ_API_KEY=your-key-here
export XAI_API_KEY=your-key-here
export AZURE_OPENAI_API_KEY=your-key-here
export COHERE_API_KEY=your-key-here
```

### Generate Your First Server

```bash
# From natural language
mcp-factory generate "Create tools for fetching weather data by city and converting temperatures"

# From OpenAPI spec
mcp-factory from-openapi ./api-spec.yaml

# From database
mcp-factory from-database ./data.db

# From GraphQL schema
mcp-factory from-graphql ./schema.graphql

# From ontology
mcp-factory from-ontology ./ontology.owl --format rdf
```

## Usage

### Natural Language Generation

```bash
mcp-factory generate "Create tools for managing a todo list with priorities" \
  --name todo-server \
  --output ./servers/todo \
  --web-search \
  --logging \
  --metrics
```

### OpenAPI Specification

```bash
# From local file
mcp-factory from-openapi ./openapi.yaml --name my-api-server

# With custom base URL
mcp-factory from-openapi ./spec.json --base-url https://api.example.com
```

### Database Schema

```bash
# SQLite
mcp-factory from-database ./myapp.db --tables users,posts,comments

# PostgreSQL
mcp-factory from-database "postgresql://user:pass@localhost/mydb" --type postgresql
```

### GraphQL Schema

```bash
# From a GraphQL SDL file
mcp-factory from-graphql ./schema.graphql --name my-graphql-server

# From a URL endpoint
mcp-factory from-graphql https://api.example.com/graphql --name my-api-server
```

GraphQL queries are mapped to read-only MCP tools, and mutations are mapped to write tools. GraphQL types are automatically converted to Zod validation schemas.

### Ontology

```bash
# From RDF/OWL (.owl, .rdf, .ttl)
mcp-factory from-ontology ./ontology.owl --format rdf --name knowledge-server

# From JSON-LD (.jsonld)
mcp-factory from-ontology ./schema.jsonld --format jsonld --name linked-data-server

# From custom YAML ontology
mcp-factory from-ontology ./domain.yaml --format yaml --name domain-server
```

OWL Classes are mapped to MCP Resources, ObjectProperties become Tools, and DataProperties become tool parameters.

### Test & Serve

```bash
# Run tests
mcp-factory test ./servers/my-server

# Start server for testing
mcp-factory serve ./servers/my-server
```

## Generated Server Structure

```
servers/my-server/
├── src/
│   └── index.ts          # MCP server with tools, resources, and prompts
├── tests/
│   └── tools.test.ts     # Vitest tests (InMemoryTransport)
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── Dockerfile            # Container deployment
├── README.md             # Usage documentation
├── skill.md              # Claude Code skill file
├── server.json           # MCP Registry manifest
├── EXECUTION_LOG.md      # Generation trace (optional)
└── .github/
    └── workflows/
        └── ci.yml        # GitHub Actions CI/CD
```

Generated servers export a `createServer()` factory function for easy testing. The server uses Streamable HTTP transport with a single `/mcp` POST endpoint and a `/health` GET endpoint. Tests use `InMemoryTransport.createLinkedPair()` for fast, reliable in-process testing with vitest.

## CLI Reference

| Command | Description |
|---------|-------------|
| `generate <description>` | Generate MCP server from natural language |
| `from-openapi <spec>` | Generate from OpenAPI specification |
| `from-database <path>` | Generate from database schema |
| `from-graphql <schema>` | Generate from GraphQL schema |
| `from-ontology <file>` | Generate from RDF/OWL, JSON-LD, or YAML ontology |
| `test <server-path>` | Run tests for generated server |
| `serve <server-path>` | Start server for testing |
| `info` | Display factory information |

### Generate Options

```bash
mcp-factory generate "..." \
  --output, -o <path>           # Output directory (default: ./servers)
  --name, -n <name>             # Server name
  --description, -d <desc>      # Package description
  --github-username, -g <user>  # GitHub username for MCP Registry
  --version, -v <ver>           # Server version (default: 1.0.0)
  --provider, -p <provider>     # LLM provider (anthropic, openai, google, mistral, deepseek, groq, xai, azure, cohere, claude_code)
  --model, -m <model>           # Specific model to use
  --web-search, -w              # Search web for API documentation
  --auth <vars...>              # Environment variables for auth
  --health-check                # Include health check endpoint (default: true)
  --logging                     # Enable structured logging (default: true)
  --metrics                     # Enable Prometheus metrics
  --rate-limit <n>              # Rate limiting (requests per minute)
  --retries                     # Enable retry logic (default: true)
  --budget <amount>             # Maximum spend in USD (aborts if exceeded)
  --compare-costs               # Show cost comparison across providers before generating
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | At least one |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token | provider key |
| `OPENAI_API_KEY` | OpenAI API key | is required |
| `GOOGLE_API_KEY` | Google Gemini API key | for generation |
| `MISTRAL_API_KEY` | Mistral AI API key | |
| `DEEPSEEK_API_KEY` | DeepSeek API key | |
| `GROQ_API_KEY` | Groq API key | |
| `XAI_API_KEY` | xAI Grok API key | |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | |
| `COHERE_API_KEY` | Cohere API key | |

### LLM Providers

All providers use the [Vercel AI SDK](https://sdk.vercel.ai/) via a unified `UnifiedLLMProvider` class with lazy dynamic imports — only the `@ai-sdk/*` package for your chosen provider is loaded at runtime.

| Provider | Models | Best For |
|----------|--------|----------|
| Anthropic | claude-opus-4-6, claude-sonnet-4-5, claude-haiku-4-5 | Highest quality |
| OpenAI | gpt-5.2, gpt-5.2-codex, o3, o4-mini | Fast generation |
| Google | gemini-3-pro, gemini-3-flash, gemini-2.5-pro | Cost effective |
| Mistral | mistral-large, codestral, magistral | European AI, code |
| DeepSeek | deepseek-chat, deepseek-reasoner | Ultra low cost |
| Groq | llama-3.3-70b, llama-4-maverick | Ultra-fast inference |
| xAI | grok-4, grok-3, grok-code-fast | Reasoning |
| Azure | gpt-4o (Azure-hosted) | Enterprise compliance |
| Cohere | command-a, command-r+ | RAG, enterprise search |
| Claude Code | claude-sonnet-4-5 (OAuth) | Claude Code users |

## Programmatic Usage

### Basic Usage

```typescript
import { ToolFactoryAgent, writeServerToDirectory, formatCost } from '@heshamfsalama/mcp-tool-factory';

// Create agent (auto-detects provider from env vars)
const agent = new ToolFactoryAgent();

// Generate from description
const server = await agent.generateFromDescription(
  'Create tools for managing a todo list with priorities',
  {
    serverName: 'todo-server',
    webSearch: true,
    parallel: true,           // Enable parallel generation (default)
    maxConcurrency: 5,        // Max concurrent LLM calls (default)
    budget: 1.00,             // Optional: abort if cost exceeds $1.00
    productionConfig: {
      enableLogging: true,
      enableMetrics: true,
    },
  }
);

// Cost tracking — see how much the generation cost
if (server.executionLog) {
  console.log(`Cost: ${formatCost(server.executionLog.totalCost)}`);
}

// Write to directory
await writeServerToDirectory(server, './servers/todo');
```

### From OpenAPI

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from '@heshamfsalama/mcp-tool-factory';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

const spec = yaml.load(readFileSync('./openapi.yaml', 'utf-8'));
const agent = new ToolFactoryAgent({ requireLlm: false });

const server = await agent.generateFromOpenAPI(spec, {
  serverName: 'my-api-server',
  baseUrl: 'https://api.example.com',
});

await writeServerToDirectory(server, './servers/api');
```

### From Database

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from '@heshamfsalama/mcp-tool-factory';

const agent = new ToolFactoryAgent({ requireLlm: false });

// SQLite (auto-detected from file path)
const server = await agent.generateFromDatabase('./data/app.db', {
  serverName: 'app-database-server',
  tables: ['users', 'posts', 'comments'],
});

// PostgreSQL (auto-detected from connection string)
const pgServer = await agent.generateFromDatabase(
  'postgresql://user:pass@localhost/mydb',
  { serverName: 'postgres-server' }
);

await writeServerToDirectory(server, './servers/app-db');
```

### From GraphQL

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from '@heshamfsalama/mcp-tool-factory';
import { readFileSync } from 'fs';

const schema = readFileSync('./schema.graphql', 'utf-8');
const agent = new ToolFactoryAgent({ requireLlm: false });

const server = await agent.generateFromGraphQL(schema, {
  serverName: 'my-graphql-server',
});

await writeServerToDirectory(server, './servers/graphql');
```

### From Ontology

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from '@heshamfsalama/mcp-tool-factory';
import { readFileSync } from 'fs';

const ontologyData = readFileSync('./ontology.owl', 'utf-8');
const agent = new ToolFactoryAgent({ requireLlm: false });

const server = await agent.generateFromOntology(ontologyData, {
  serverName: 'knowledge-server',
  format: 'rdf',
});

await writeServerToDirectory(server, './servers/knowledge');
```

### Code Validation

```typescript
import { validateTypeScriptCode, validateGeneratedServer } from '@heshamfsalama/mcp-tool-factory';

// Validate TypeScript syntax
const result = await validateTypeScriptCode(code);
// { valid: false, errors: [{ line: 4, column: 1, message: "'}' expected." }] }

// Validate complete server
const serverResult = await validateGeneratedServer(serverCode);
// { valid: true, errors: [], summary: 'Generated server code is syntactically valid' }
```

## Use with AI Frameworks

### Claude Code / Claude Desktop

Add to your MCP settings (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["tsx", "./servers/my-server/src/index.ts"]
    }
  }
}
```

### OpenAI Agents SDK

```python
from agents import Agent
from agents.mcp import MCPServerStdio

async with MCPServerStdio(
    command="npx",
    args=["tsx", "./servers/my-server/src/index.ts"]
) as mcp:
    agent = Agent(
        name="My Agent",
        tools=mcp.list_tools()
    )
```

### Google ADK

```python
from google.adk.tools.mcp_tool import MCPToolset

tools = MCPToolset(
    connection_params=StdioServerParameters(
        command="npx",
        args=["tsx", "./servers/my-server/src/index.ts"]
    )
)
```

### LangChain

```python
from langchain_mcp_adapters.client import MCPClient

client = MCPClient(
    command="npx",
    args=["tsx", "./servers/my-server/src/index.ts"]
)
tools = client.get_tools()
```

## Production Features

### Structured Logging

```bash
mcp-factory generate "..." --logging
```

Generates servers with [pino](https://github.com/pinojs/pino) structured JSON logging:

```typescript
const logger = pino({ level: 'info' });
logger.info({ tool: 'get_weather', params }, 'Tool called');
```

### Prometheus Metrics

```bash
mcp-factory generate "..." --metrics
```

Generates servers with [prom-client](https://github.com/siimon/prom-client) metrics:

- `mcp_tool_calls_total` - Counter of tool invocations
- `mcp_tool_duration_seconds` - Histogram of execution times

### Rate Limiting

```bash
mcp-factory generate "..." --rate-limit 100
```

Configurable rate limiting per client with sliding window.

### Retry Logic

```bash
mcp-factory generate "..." --retries
```

Exponential backoff retry for transient failures.

### Structured Error Codes

Generated servers use structured error codes for consistent error handling:

- `INVALID_INPUT` - Malformed or invalid tool parameters
- `NOT_FOUND` - Requested resource does not exist
- `AUTH_ERROR` - Authentication or authorization failure
- `INTERNAL_ERROR` - Unexpected server error

### Enhanced Health Check

The `/health` endpoint returns detailed server status:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600,
  "memory": { "rss": 52428800, "heapUsed": 20971520 },
  "transport": "streamable-http"
}
```

## MCP Registry Publishing

Publish your generated servers to the [MCP Registry](https://registry.modelcontextprotocol.io) for discoverability.

### Generate with Registry Support

```bash
mcp-factory generate "Create weather tools" \
  --name weather-server \
  --github-username your-github-username \
  --description "Weather tools for Claude" \
  --version 1.0.0
```

This generates registry-compliant files:

**package.json:**
```json
{
  "name": "@your-github-username/weather-server",
  "mcpName": "io.github.your-github-username/weather-server"
}
```

**server.json:**
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.your-github-username/weather-server",
  "packages": [{
    "registryType": "npm",
    "identifier": "@your-github-username/weather-server",
    "transport": { "type": "stdio" }
  }],
  "tools": [...]
}
```

### Publish Workflow

```bash
# 1. Build and publish to npm
cd ./servers/weather-server
npm install && npm run build
npm publish --access public

# 2. Install mcp-publisher
brew install modelcontextprotocol/tap/mcp-publisher

# 3. Authenticate
mcp-publisher login github

# 4. Publish to registry
mcp-publisher publish
```

See [Publishing Guide](docs/publishing.md) for detailed instructions.

## Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         MCP Tool Factory                               │
├───────────────────────────────────────────────────────────────────────┤
│  Input Sources                                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐│
│  │ Natural   │ │  OpenAPI  │ │ Database  │ │ GraphQL   │ │Ontology ││
│  │ Language  │ │   Spec    │ │  Schema   │ │  Schema   │ │RDF/YAML ││
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └────┬────┘│
│        └──────────┬───┴─────────────┴─────────────┴────────────┘     │
│                   ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                     ToolFactoryAgent                            │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │  UnifiedLLMProvider (Vercel AI SDK)                      │   │   │
│  │  │  Anthropic │ OpenAI │ Google │ Mistral │ DeepSeek       │   │   │
│  │  │  Groq │ xAI │ Azure │ Cohere + Claude Code OAuth       │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐  │   │
│  │  │  LLM Cache   │ │  Cost        │ │ Parallel Generation   │  │   │
│  │  │  (TTL-based) │ │  Tracking    │ │ (max concurrency: 5)  │  │   │
│  │  └──────────────┘ └──────────────┘ └───────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                   │                                                    │
│                   ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                       Generators                                │   │
│  │  ServerGenerator  │  DocsGenerator  │  TestsGenerator          │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                   │                                                    │
│                   ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                     GeneratedServer                             │   │
│  │  Tools │ Resources │ Prompts │ Tests │ Docs │ Dockerfile       │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                   │                                                    │
│                   ▼                                                    │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                Streamable HTTP Transport                        │   │
│  │          POST /mcp  │  GET /health                             │   │
│  └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

## Development

```bash
# Clone the repository
git clone https://github.com/HeshamFS/mcp-tool-factory-ts.git
cd mcp-tool-factory-ts

# Install dependencies
pnpm install

# Build
pnpm run build

# Run tests
pnpm test

# Type check
pnpm run typecheck

# Lint
pnpm run lint
```

## Project Structure

```
mcp-tool-factory-ts/
├── src/
│   ├── agent/              # Main ToolFactoryAgent
│   ├── auth/               # OAuth2 providers
│   ├── cache/              # LLM response caching with configurable TTL
│   ├── cli/                # Command-line interface
│   ├── config/             # Configuration management
│   ├── database/           # Database introspection (SQLite, PostgreSQL)
│   ├── execution-logger/   # Execution logging
│   ├── generators/         # Code generators (server, docs, tests)
│   ├── graphql/            # GraphQL SDL parsing and server generation
│   ├── middleware/         # Validation middleware
│   ├── models/             # Data models
│   ├── observability/      # Telemetry and tracing
│   ├── ontology/           # Ontology parsing (RDF/OWL, JSON-LD, YAML)
│   ├── openapi/            # OpenAPI spec parsing
│   ├── production/         # Production code generation
│   ├── prompts/            # LLM prompt templates
│   ├── providers/          # LLM providers (10 providers via Vercel AI SDK + Claude Code)
│   ├── security/           # Security scanning
│   ├── server/             # MCP server mode (factory-as-a-server)
│   ├── templates/          # Handlebars templates for generated files
│   ├── validation/         # Code validation and Zod schemas
│   └── web-search/         # Web search integration
├── docs/                   # Documentation
├── tests/                  # Test files
└── dist/                   # Built output
```

## Documentation

- [Getting Started](docs/getting-started.md)
- [CLI Reference](docs/cli-reference.md)
- [API Reference](docs/api-reference.md)
- [Examples](docs/examples.md)
- [OpenAPI Guide](docs/openapi.md)
- [Database Guide](docs/database.md)
- [Providers Guide](docs/providers.md)
- [Production Features](docs/production.md)
- [Architecture](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](docs/contributing.md)

## Troubleshooting

### Common Issues

**API Key Not Found**
```bash
# Check your environment
echo $ANTHROPIC_API_KEY

# Set it
export ANTHROPIC_API_KEY=your-key-here
```

**Generated Server Won't Start**
```bash
# Install dependencies first
cd ./servers/my-server
npm install
npx tsx src/index.ts
```

**TypeScript Errors**
```bash
# Validate generated code
import { validateGeneratedServer } from '@heshamfsalama/mcp-tool-factory';
const result = await validateGeneratedServer(code);
console.log(result.errors);
```

See [Troubleshooting Guide](docs/troubleshooting.md) for more solutions.

## Changelog

### v0.3.0

- **Vercel AI SDK Migration** - All LLM providers now use the [Vercel AI SDK](https://sdk.vercel.ai/) via a single `UnifiedLLMProvider` class with lazy dynamic imports. Removed ~473 LOC of provider-specific implementations. Only the `@ai-sdk/*` package for your chosen provider is loaded at runtime.
- **10 LLM Providers** - Added Mistral, DeepSeek, Groq, xAI, Azure, and Cohere alongside existing Anthropic, OpenAI, Google, and Claude Code providers. All use the same unified interface.
- **Cost Tracking** - Every LLM call now calculates estimated cost using a built-in pricing table for 50+ models. Shows per-call cost, total generation cost, and per-phase breakdown (tool extraction, implementation, tests, docs). Detailed token breakdowns include cache read/write tokens and reasoning tokens from the AI SDK.
- **Budget Limits** (`--budget <amount>`) - Set a maximum spend in USD. Generation aborts gracefully with `BudgetExceededError` if cumulative cost exceeds the budget.
- **Provider Cost Comparison** (`--compare-costs`) - Before generation, estimates cost across all available providers and shows a sorted comparison table. No extra API calls needed — uses the static pricing table.
- **Per-Phase Cost Breakdown** - CLI output and execution logs show which generation steps cost the most (tool extraction, implementation, resource extraction, prompt extraction, test generation, docs generation).
- **OpenAI Reasoning Model Support** - Temperature parameter is automatically omitted for OpenAI o-series and gpt-5.x models that don't support it.

### v0.2.0

- **Streamable HTTP Transport** - Generated servers use `StreamableHTTPServerTransport` with native `http` module instead of Express/SSE (deprecated June 2025). Single `/mcp` POST endpoint with `/health` GET endpoint.
- **MCP SDK v1.26.0** - Updated from `^1.0.0` to `^1.26.0`
- **Resources & Prompts** - Full support for all three MCP primitives. Resources expose structured data (documents, DB records, file trees). Prompts provide reusable templates for guided LLM workflows. Agent automatically extracts resources and prompts from descriptions via LLM.
- **GraphQL Input Source** - New `from-graphql` CLI command and `generate_from_graphql` MCP tool. Queries map to read tools, mutations map to write tools, and GraphQL types are converted to Zod schemas.
- **Ontology Input Source** - New `from-ontology` CLI command and `generate_from_ontology` MCP tool. Supports RDF/OWL, JSON-LD, and custom YAML formats. OWL Classes map to Resources, ObjectProperties to Tools, DataProperties to tool parameters.
- **LLM Response Caching** - Deduplicates identical LLM calls with configurable TTL. Bypass with `skipCache` option.
- **Parallel Generation** - Tool implementations generated concurrently by default (`parallel: true`, `maxConcurrency: 5`). Significant speed improvement for multi-tool servers.
- **InMemoryTransport Testing** - Generated tests use `InMemoryTransport.createLinkedPair()` instead of subprocess spawning. Servers export `createServer()` factory function for testability.
- **Production Enhancements** - Rate limiting, structured logging, metrics, and duration tracking wired into tool handlers. Enhanced health check with version, uptime, memory, and transport info. Structured error codes: `INVALID_INPUT`, `NOT_FOUND`, `AUTH_ERROR`, `INTERNAL_ERROR`.

### v0.1.0

- Initial TypeScript release
- Natural language generation with Claude, Claude Code, OpenAI, Google Gemini
- OpenAPI 3.0+ specification import
- Database CRUD generation (SQLite, PostgreSQL)
- Production features (logging, metrics, rate limiting)
- MCP Registry server.json generation
- TypeScript syntax validation
- Web search for API documentation
- GitHub Actions CI/CD generation
- MCP Server mode for on-the-fly generation with Claude

## License

MIT

## Links

- [GitHub Repository](https://github.com/HeshamFS/mcp-tool-factory-ts)
- [npm Package](https://www.npmjs.com/package/@heshamfsalama/mcp-tool-factory)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP Registry](https://github.com/modelcontextprotocol/registry)
- [Python Version](https://github.com/HeshamFS/mcp-tool-factory)
