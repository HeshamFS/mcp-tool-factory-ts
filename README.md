# MCP Tool Factory (TypeScript)

Generate production-ready MCP (Model Context Protocol) servers from natural language descriptions, OpenAPI specs, or database schemas.

[![npm version](https://img.shields.io/npm/v/@heshamfsalama/mcp-tool-factory.svg)](https://www.npmjs.com/package/@heshamfsalama/mcp-tool-factory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

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
| **Multi-Provider** | Works with Claude, Claude Code, OpenAI GPT, and Google Gemini |
| **Web Search** | Auto-fetch API documentation for better generation |
| **Production Ready** | Logging, metrics, rate limiting, retries built-in |
| **Type Safe** | Full TypeScript with strict mode |
| **MCP Registry** | Generates server.json for registry publishing |
| **Is an MCP Server** | Use it directly with Claude to generate servers on-the-fly |

## Use as MCP Server

MCP Tool Factory is itself an MCP server! Add it to Claude Desktop or Claude Code to generate MCP servers through conversation.

### Claude Desktop / Cursor Configuration

Add to your MCP config file (`claude_desktop_config.json` or `mcp.json`):

```json
{
  "mcpServers": {
    "mcp-tool-factory": {
      "command": "node",
      "args": ["path/to/mcp-tool-factory-ts/bin/mcp-server.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

Or with npx (after publishing to npm):

```json
{
  "mcpServers": {
    "mcp-tool-factory": {
      "command": "npx",
      "args": ["-y", "@heshamfsalama/mcp-tool-factory", "server"],
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

> **Note:** Only one provider API key is required. You can use any of:
> - `ANTHROPIC_API_KEY` - Anthropic Claude
> - `CLAUDE_CODE_OAUTH_TOKEN` - Claude Code OAuth
> - `OPENAI_API_KEY` - OpenAI GPT
> - `GOOGLE_API_KEY` - Google Gemini

### Claude Code Configuration

```bash
# Using local path
claude mcp add mcp-tool-factory -- node path/to/mcp-tool-factory-ts/bin/mcp-server.js

# Or with npx (after publishing)
claude mcp add mcp-tool-factory -- npx -y @heshamfsalama/mcp-tool-factory server
```

### Available Tools

| Tool | Description |
|------|-------------|
| `generate_mcp_server` | Generate from natural language description |
| `generate_from_openapi` | Generate from OpenAPI specification |
| `generate_from_database` | Generate from database schema |
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

# Or OpenAI
export OPENAI_API_KEY=your-key-here

# Or Google Gemini
export GOOGLE_API_KEY=your-key-here
```

### Generate Your First Server

```bash
# From natural language
mcp-factory generate "Create tools for fetching weather data by city and converting temperatures"

# From OpenAPI spec
mcp-factory from-openapi ./api-spec.yaml

# From database
mcp-factory from-database ./data.db
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
│   └── index.ts          # MCP server with all tools
├── tests/
│   └── tools.test.ts     # Vitest tests
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

## CLI Reference

| Command | Description |
|---------|-------------|
| `generate <description>` | Generate MCP server from natural language |
| `from-openapi <spec>` | Generate from OpenAPI specification |
| `from-database <path>` | Generate from database schema |
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
  --provider, -p <provider>     # LLM provider (anthropic, claude_code, openai, google)
  --model, -m <model>           # Specific model to use
  --web-search, -w              # Search web for API documentation
  --auth <vars...>              # Environment variables for auth
  --health-check                # Include health check endpoint (default: true)
  --logging                     # Enable structured logging (default: true)
  --metrics                     # Enable Prometheus metrics
  --rate-limit <n>              # Rate limiting (requests per minute)
  --retries                     # Enable retry logic (default: true)
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | At least one |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token | of these 4 |
| `OPENAI_API_KEY` | OpenAI API key | is required |
| `GOOGLE_API_KEY` | Google Gemini API key | for generation |

### LLM Providers

| Provider | Models | Best For |
|----------|--------|----------|
| Anthropic | claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5 | Highest quality |
| Claude Code | claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5 | Claude Code users |
| OpenAI | gpt-5.2, gpt-5.2-codex, gpt-5.1, gpt-5 | Fast generation |
| Google | gemini-3-flash, gemini-3-pro, gemini-2.5-flash | Cost effective |

## Programmatic Usage

### Basic Usage

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from '@heshamfsalama/mcp-tool-factory';

// Create agent (auto-detects provider from env vars)
const agent = new ToolFactoryAgent();

// Generate from description
const server = await agent.generateFromDescription(
  'Create tools for managing a todo list with priorities',
  {
    serverName: 'todo-server',
    webSearch: true,
    productionConfig: {
      enableLogging: true,
      enableMetrics: true,
    },
  }
);

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
┌─────────────────────────────────────────────────────────────┐
│                    MCP Tool Factory                          │
├─────────────────────────────────────────────────────────────┤
│  Input Sources                                               │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │
│  │ Natural Lang  │ │   OpenAPI     │ │   Database    │     │
│  │ Description   │ │ Specification │ │    Schema     │     │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘     │
│          │                 │                 │              │
│          ▼                 ▼                 ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ToolFactoryAgent                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │ Claude  │ │ OpenAI  │ │ Gemini  │ │  Code   │   │   │
│  │  │Provider │ │Provider │ │Provider │ │Provider │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│          │                                                  │
│          ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Generators                         │   │
│  │  ServerGenerator │ DocsGenerator │ TestsGenerator   │   │
│  └─────────────────────────────────────────────────────┘   │
│          │                                                  │
│          ▼                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GeneratedServer                         │   │
│  │  server.ts │ tests │ README │ Dockerfile │ CI/CD    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
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
│   ├── agent/           # Main ToolFactoryAgent
│   ├── auth/            # OAuth2 providers
│   ├── cli/             # Command-line interface
│   ├── config/          # Configuration management
│   ├── database/        # Database introspection
│   ├── generators/      # Code generators
│   ├── models/          # Data models
│   ├── openapi/         # OpenAPI parser
│   ├── prompts/         # LLM prompts
│   ├── providers/       # LLM providers
│   ├── templates/       # Handlebars templates
│   ├── validation/      # Code validation
│   └── web-search/      # Web search integration
├── docs/                # Documentation
├── tests/               # Test files
└── dist/                # Built output
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
