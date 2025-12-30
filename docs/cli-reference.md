# CLI Reference

Complete reference for the MCP Tool Factory command-line interface.

## Overview

```bash
mcp-factory <command> [options]
```

### Global Options

| Option | Description |
|--------|-------------|
| `--version`, `-V` | Display version number |
| `--help`, `-h` | Display help |

### Available Commands

| Command | Description |
|---------|-------------|
| `generate` | Generate MCP server from natural language |
| `from-openapi` | Generate from OpenAPI specification |
| `from-database` | Generate from database schema |
| `test` | Run tests for generated server |
| `serve` | Start server for testing |
| `info` | Display factory information |

---

## generate

Generate an MCP server from a natural language description.

### Synopsis

```bash
mcp-factory generate <description> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `description` | Natural language description of tools | Yes |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output directory | `./servers` |
| `-n, --name <name>` | Server name | `GeneratedToolServer` |
| `-d, --description <desc>` | Package description | Auto-generated |
| `-g, --github-username <user>` | GitHub username for MCP Registry | None |
| `-v, --version <ver>` | Server version | `1.0.0` |
| `-p, --provider <provider>` | LLM provider | Auto-detect |
| `-m, --model <model>` | Specific model | Provider default |
| `-w, --web-search` | Search web for API docs | `false` |
| `-a, --auth <vars...>` | Environment variables for auth | None |
| `--health-check` | Include health check | `true` |
| `--no-health-check` | Disable health check | - |
| `--logging` | Enable structured logging | `true` |
| `--no-logging` | Disable logging | - |
| `--metrics` | Enable Prometheus metrics | `false` |
| `--rate-limit <n>` | Rate limit (requests/min) | None |
| `--retries` | Enable retry logic | `true` |
| `--no-retries` | Disable retries | - |

### Examples

**Basic generation:**
```bash
mcp-factory generate "Create tools for managing a todo list"
```

**Custom output and name:**
```bash
mcp-factory generate "Create weather tools" \
  --output ./my-servers \
  --name weather-service
```

**With web search for API documentation:**
```bash
mcp-factory generate "Create tools for the Stripe API" \
  --web-search
```

**With API key requirement:**
```bash
mcp-factory generate "Create GitHub API tools" \
  --auth GITHUB_TOKEN
```

**Production configuration:**
```bash
mcp-factory generate "Create database tools" \
  --logging \
  --metrics \
  --rate-limit 100 \
  --retries
```

**For MCP Registry publishing:**
```bash
mcp-factory generate "Create weather tools" \
  --name weather-server \
  --github-username your-username \
  --description "Weather tools for Claude" \
  --version 1.0.0
```

**Minimal server (no production features):**
```bash
mcp-factory generate "Simple calculator tools" \
  --no-logging \
  --no-health-check \
  --no-retries
```

### Output Structure

```
servers/<name>/
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

## from-openapi

Generate an MCP server from an OpenAPI specification.

### Synopsis

```bash
mcp-factory from-openapi <spec-path> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `spec-path` | Path to OpenAPI file (JSON/YAML) | Yes |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output directory | `./servers` |
| `-n, --name <name>` | Server name | Auto from spec |
| `-u, --base-url <url>` | API base URL | From spec |

### Examples

**Basic usage:**
```bash
mcp-factory from-openapi ./petstore.yaml
```

**Custom name and output:**
```bash
mcp-factory from-openapi ./api.json \
  --name my-api-server \
  --output ./servers/api
```

**With custom base URL:**
```bash
mcp-factory from-openapi ./spec.yaml \
  --base-url https://api.production.com/v2
```

### Supported Auth Types

| Auth Type | OpenAPI Security Scheme |
|-----------|------------------------|
| API Key | `apiKey` (header, query, cookie) |
| Bearer Token | `http` with `bearer` scheme |
| Basic Auth | `http` with `basic` scheme |
| OAuth2 | `oauth2` (all flows) |

### OpenAPI Requirements

- OpenAPI 3.0.0 or higher
- Valid JSON or YAML format
- At least one path with operations
- Proper schema definitions for parameters

---

## from-database

Generate an MCP server with CRUD tools from a database schema.

### Synopsis

```bash
mcp-factory from-database <database-path> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `database-path` | SQLite file path or PostgreSQL connection string | Yes |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output directory | `./servers` |
| `-n, --name <name>` | Server name | Auto from database |
| `-t, --type <type>` | Database type | Auto-detect |
| `-T, --tables <tables...>` | Specific tables to include | All tables |

### Examples

**SQLite database:**
```bash
mcp-factory from-database ./myapp.db
```

**Specific tables only:**
```bash
mcp-factory from-database ./data.db \
  --tables users posts comments
```

**PostgreSQL:**
```bash
mcp-factory from-database "postgresql://user:pass@localhost/mydb" \
  --type postgresql
```

**Custom server name:**
```bash
mcp-factory from-database ./store.db \
  --name ecommerce-crud-server
```

### Generated CRUD Tools

For each table, these tools are generated:

| Tool | Description |
|------|-------------|
| `get_<table>` | Get single record by primary key |
| `list_<table>` | List records with pagination |
| `create_<table>` | Create new record |
| `update_<table>` | Update existing record |
| `delete_<table>` | Delete record by primary key |
| `health_check` | Database connection health |

### Example Output

For a `users` table:

```typescript
// get_users - Get user by ID
server.tool('get_users', { id: z.number() }, async ({ id }) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return { content: [{ type: 'text', text: JSON.stringify(row) }] };
});

// list_users - List users with pagination
server.tool('list_users', { limit: z.number(), offset: z.number() }, async ({ limit, offset }) => {
  const rows = db.prepare('SELECT * FROM users LIMIT ? OFFSET ?').all(limit, offset);
  return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
});
```

---

## test

Run tests for a generated MCP server.

### Synopsis

```bash
mcp-factory test <server-path>
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `server-path` | Directory containing generated server | Yes |

### Examples

```bash
mcp-factory test ./servers/my-server
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | Some tests failed |

---

## serve

Start an MCP server for testing.

### Synopsis

```bash
mcp-factory serve <server-path> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `server-path` | Directory containing server.ts | Yes |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --transport <type>` | Transport type (stdio, sse) | `stdio` |
| `-p, --port <port>` | Port for SSE transport | `8000` |

### Examples

**Standard stdio transport:**
```bash
mcp-factory serve ./servers/my-server
```

**SSE transport:**
```bash
mcp-factory serve ./servers/my-server \
  --transport sse \
  --port 3000
```

### Stopping the Server

Press `Ctrl+C` to stop the server.

---

## info

Display information about MCP Tool Factory.

### Synopsis

```bash
mcp-factory info
```

### Output

Displays:
- Version number
- Available commands
- Supported features
- Supported frameworks

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error occurred |

## Tips

### Combining with Shell Variables

```bash
# Use environment variable for description
TOOLS="weather, time, and currency conversion"
mcp-factory generate "Create tools for $TOOLS"
```

### Batch Generation

```bash
# Generate multiple servers
for api in petstore github stripe; do
  mcp-factory from-openapi ./specs/${api}.yaml \
    --name ${api}-server \
    --output ./servers/${api}
done
```

### Piping Descriptions

```bash
# Read description from file
cat tool-description.txt | xargs mcp-factory generate
```
