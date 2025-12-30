# Getting Started

This guide will help you install MCP Tool Factory and generate your first MCP server.

## Prerequisites

- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **npm, pnpm, or yarn** - Package manager
- **API Key** - From Anthropic, OpenAI, or Google

## Installation

### Global Installation (Recommended)

```bash
npm install -g mcp-tool-factory
```

### Using npx (No Installation)

```bash
npx mcp-tool-factory generate "Create tools for a todo list"
```

### Local Project Installation

```bash
npm install mcp-tool-factory
```

## Configuration

### Get Your API Key

| Provider | Get API Key | Environment Variable |
|----------|------------|---------------------|
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) | `ANTHROPIC_API_KEY` |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | `OPENAI_API_KEY` |
| Google | [aistudio.google.com](https://aistudio.google.com/apikey) | `GOOGLE_API_KEY` |

### Set Your API Key

```bash
# Linux/macOS
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."

# Windows (Command Prompt)
set ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Verify Installation

```bash
mcp-factory info
```

## Quick Start

### Step 1: Generate a Server

```bash
mcp-factory generate "Create tools for fetching weather data by city name"
```

### Step 2: Navigate to Output

```bash
cd servers/generatedtoolserver
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run the Server

```bash
npx tsx src/index.ts
```

### Step 5: Test with MCP Inspector

```bash
npx @anthropic-ai/mcp-inspector
```

## Next Steps

- [CLI Reference](cli-reference.md) - Learn all CLI commands
- [API Reference](api-reference.md) - Use programmatically
- [Examples](examples.md) - See real-world examples

## Common First-Time Issues

### "API key not found"

Make sure your API key is set in the environment:

```bash
echo $ANTHROPIC_API_KEY
```

If empty, set it:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

### "Command not found: mcp-factory"

Install globally:

```bash
npm install -g mcp-tool-factory
```

Or use npx:

```bash
npx mcp-tool-factory generate "..."
```

### "Cannot find module 'tsx'"

Install tsx in the generated server directory:

```bash
cd servers/my-server
npm install
```

## Example: Weather API Server

Let's build a complete weather API server:

```bash
# Generate the server
mcp-factory generate "Create tools for:
1. Getting current weather by city name
2. Getting 5-day forecast
3. Converting between Celsius and Fahrenheit
4. Getting UV index by location" \
  --name weather-server \
  --output ./servers/weather \
  --web-search \
  --logging

# Navigate and install
cd servers/weather
npm install

# Run
npx tsx src/index.ts
```

This generates a complete MCP server with:
- 4 weather-related tools
- Structured logging
- TypeScript types
- Tests
- Dockerfile
- CI/CD pipeline

## Summary

1. **Install**: `npm install -g mcp-tool-factory`
2. **Configure**: `export ANTHROPIC_API_KEY=...`
3. **Generate**: `mcp-factory generate "..."`
4. **Run**: `cd servers/... && npm install && npx tsx src/index.ts`

Ready to learn more? Check out the [CLI Reference](cli-reference.md) for all available commands.
