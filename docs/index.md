# MCP Tool Factory Documentation

Welcome to the MCP Tool Factory documentation. This guide will help you generate production-ready MCP servers from natural language, OpenAPI specs, or database schemas.

## What is MCP Tool Factory?

MCP Tool Factory is a TypeScript library and CLI that generates complete Model Context Protocol (MCP) servers. These servers expose tools that can be used by AI assistants like Claude, ChatGPT, and Gemini.

## Quick Navigation

### Getting Started
- [Getting Started](getting-started.md) - Installation and first server
- [CLI Reference](cli-reference.md) - Command-line interface
- [API Reference](api-reference.md) - Programmatic TypeScript API

### Input Sources
- [OpenAPI Guide](openapi.md) - Generate from REST API specs
- [Database Guide](database.md) - Generate CRUD tools from databases

### Features
- [Providers Guide](providers.md) - LLM provider configuration
- [Production Features](production.md) - Logging, metrics, rate limiting
- [Publishing to Registry](publishing.md) - Publish to MCP Registry
- [Examples](examples.md) - Real-world usage examples

### Reference
- [Architecture](architecture.md) - System design and internals
- [Troubleshooting](troubleshooting.md) - Common issues and solutions
- [Contributing](contributing.md) - Development guide

## Why MCP?

The Model Context Protocol (MCP) is an open standard that enables:

- **Unified Tool Interface** - One server works with Claude, OpenAI, Google, LangChain
- **Secure Connections** - Controlled access to external data and APIs
- **Standardized Schema** - Tools are self-describing with JSON Schema
- **Transport Agnostic** - Works over stdio, HTTP/SSE, WebSocket

## Feature Highlights

| Feature | Description |
|---------|-------------|
| **Multi-Input** | Natural language, OpenAPI, or database |
| **Multi-Provider** | Claude, GPT-4, Gemini |
| **Web Search** | Auto-fetch API docs for better generation |
| **Production Ready** | Logging, metrics, rate limiting, retries |
| **Type Safe** | Full TypeScript with strict mode |
| **MCP Registry** | Generates server.json for publishing |

## Supported Frameworks

| Framework | Integration |
|-----------|-------------|
| Claude Code | Native MCP support |
| Claude Desktop | Native MCP support |
| OpenAI Agents SDK | MCPServerStdio adapter |
| Google ADK | MCPToolset adapter |
| LangChain | langchain-mcp-adapters |
| CrewAI | MCP tool wrapper |

## Quick Example

```bash
# Install
npm install -g mcp-tool-factory

# Set API key
export ANTHROPIC_API_KEY=your-key

# Generate server
mcp-factory generate "Create tools for managing a todo list"

# Run it
cd servers/generatedtoolserver
npm install
npx tsx src/index.ts
```

## Project Stats

- **Language**: TypeScript 5.0+
- **Runtime**: Node.js 18+
- **Package Manager**: npm, pnpm, yarn
- **License**: MIT

## Links

- [GitHub Repository](https://github.com/HeshamFS/mcp-tool-factory-ts)
- [npm Package](https://www.npmjs.com/package/mcp-tool-factory)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [Python Version](https://github.com/HeshamFS/mcp-tool-factory)
