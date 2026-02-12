# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Tool Factory generates production-ready MCP (Model Context Protocol) servers from natural language descriptions, OpenAPI specs, database schemas, GraphQL schemas, or ontologies. It supports multiple LLM providers (Anthropic Claude, Claude Code OAuth, OpenAI, Google Gemini) and is itself an MCP server that can be used with Claude to generate servers on-the-fly.

## Commands

```bash
# Install dependencies
pnpm install

# Build (uses tsup, copies templates to dist)
pnpm run build

# Run tests (vitest)
pnpm test
pnpm test:watch              # Watch mode
pnpm test path/to/file.test.ts  # Single test file

# Type check
pnpm run typecheck

# Lint
pnpm run lint
pnpm run lint:fix
```

## Architecture

### Core Flow

```
Input (description/OpenAPI/database/GraphQL/ontology) → ToolFactoryAgent → Generators → GeneratedServer
```

1. **ToolFactoryAgent** (`src/agent/agent.ts`) - Main orchestrator that:
   - Takes input (natural language, OpenAPI spec, database path, GraphQL SDL, or ontology)
   - Uses LLM to extract tool, resource, and prompt specifications from descriptions
   - Generates implementations (parallel or sequential)
   - Coordinates generators to produce all output files

2. **LLM Providers** (`src/providers/`) - Pluggable provider system:
   - `BaseLLMProvider` - Abstract base with caching, streaming, error handling
   - Implementations: `AnthropicProvider`, `OpenAIProvider`, `GoogleProvider`, `ClaudeCodeProvider`
   - Auto-detection from environment variables via `createProvider()`

3. **Generators** (`src/generators/`) - Produce output artifacts:
   - `ServerGenerator` - Main server code, package.json, Dockerfile, GitHub Actions, server.json
   - `DocsGenerator` - README, skill.md, changelog, API docs
   - `TestsGenerator` - Vitest test files

4. **MCP Server Mode** (`src/server/index.ts`) - The factory itself as an MCP server exposing:
   - `generate_mcp_server` - From natural language
   - `generate_from_openapi` - From OpenAPI spec
   - `generate_from_database` - From database schema
   - `generate_from_graphql` - From GraphQL SDL schema
   - `generate_from_ontology` - From ontology (RDF/OWL, JSON-LD, YAML)
   - `validate_typescript` - Code validation
   - `list_providers`, `get_factory_info` - Discovery tools

### MCP Primitives

Generated servers support all three MCP primitives:
- **Tools** - `ToolSpec` (`src/models/tool-spec.ts`) - Callable functions with JSON Schema inputs
- **Resources** - `ResourceSpec` (`src/models/resource-spec.ts`) - Structured data (documents, DB records, files) exposed via URIs
- **Prompts** - `PromptSpec` (`src/models/prompt-spec.ts`) - Reusable templates with arguments for guided workflows

The agent extracts tools, resources, and prompts via separate LLM calls when generating from natural language.

### Transport

Generated servers support two transport modes (configured via `MCP_TRANSPORT` env var):
- **stdio** (default) - Standard input/output for CLI usage
- **http** - Streamable HTTP transport (`StreamableHTTPServerTransport`) on native Node.js `http` (no Express). SSE transport is deprecated as of June 2025.

### Key Modules

- **`src/openapi/`** - OpenAPI spec parsing and server generation
- **`src/database/`** - Database introspection (SQLite/PostgreSQL) and CRUD generation
- **`src/graphql/`** - GraphQL SDL parsing and server generation (`GraphQLServerGenerator`)
- **`src/ontology/`** - Ontology parsing (RDF/OWL, JSON-LD, YAML) and server generation (`OntologyParser`, `OntologyServerGenerator`)
- **`src/cache/`** - LLM response caching with configurable TTL
- **`src/validation/`** - Zod schemas, TypeScript validation, response parsing
- **`src/prompts/`** - LLM prompt templates
- **`src/templates/`** - Handlebars templates for generated files
- **`src/middleware/`** - Validation middleware
- **`src/observability/`** - Telemetry and tracing
- **`src/production/`** - Production code generation (logging, metrics, rate limiting, retries)
- **`src/security/`** - Security scanning
- **`src/execution-logger/`** - Execution logging for generation tracing

### Generation Options

The `GenerateOptions` interface controls generation behavior:
- `parallel: boolean` - Enable parallel tool implementation generation (default: true)
- `maxConcurrency: number` - Max concurrent LLM calls (default: 5)
- `skipCache: boolean` - Bypass LLM response cache
- `stream: boolean` - Enable streaming output with `onStreamToken` callback
- `webSearch: boolean` - Search web for API documentation context
- `productionConfig` - Enable logging, metrics, rate limiting, retries

### Provider Selection

Provider auto-detection checks environment variables in order:
1. `ANTHROPIC_API_KEY` → Anthropic
2. `CLAUDE_CODE_OAUTH_TOKEN` → Claude Code
3. `OPENAI_API_KEY` → OpenAI
4. `GOOGLE_API_KEY` → Google

## Module System

- ESM with `.js` extensions in imports (Node.js ESM requirement)
- TypeScript strict mode enabled
- tsup bundles to both ESM (`.js`) and CJS (`.cjs`)

## Testing

Tests use vitest. Integration tests require API keys to be set. Generated server tests use `InMemoryTransport` (not child_process spawn). The server template exports a `createServer()` factory function to support this pattern.

```bash
pnpm test tests/cache.test.ts
pnpm test tests/providers.test.ts
```

## CLI Entry Points

- `bin/mcp-factory.js` - CLI for `mcp-factory` command
- `bin/mcp-server.js` - MCP server mode entry point
