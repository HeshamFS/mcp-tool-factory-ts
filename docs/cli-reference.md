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
| `from-graphql` | Generate from GraphQL SDL schema |
| `from-ontology` | Generate from ontology (RDF/OWL, JSON-LD, YAML) |
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
| `-p, --provider <provider>` | LLM provider (anthropic, openai, google, mistral, deepseek, groq, xai, azure, cohere, claude_code) | Auto-detect |
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
| `--parallel` | Generate tool implementations in parallel | `true` |
| `--no-parallel` | Generate tool implementations sequentially | - |
| `--concurrency <n>` | Max concurrent LLM calls when parallel | `5` |
| `--no-cache` | Skip the LLM response cache | - |
| `--stream` | Stream LLM output tokens as they arrive | `false` |
| `--budget <amount>` | Maximum spend in USD; aborts if exceeded | None |
| `--compare-costs` | Show cost comparison across providers before generating | `false` |
| `-i, --interactive` | Prompt for missing options interactively | `false` |

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

**With budget limit:**
```bash
mcp-factory generate "Create complex analytics tools" \
  --budget 0.50
```

**Compare costs across providers before generating:**
```bash
mcp-factory generate "Create weather tools" \
  --compare-costs
```

**Use a specific provider (e.g., DeepSeek for low cost):**
```bash
mcp-factory generate "Create simple tools" \
  --provider deepseek \
  --model deepseek-chat
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
| `-d, --description <desc>` | Package description | From spec |
| `-g, --github-username <user>` | GitHub username for MCP Registry | None |
| `-v, --version <ver>` | Server version | `1.0.0` |
| `-i, --interactive` | Prompt for missing options | `false` |

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
| `-d, --description <desc>` | Package description | Auto-generated |
| `-g, --github-username <user>` | GitHub username for MCP Registry | None |
| `-v, --version <ver>` | Server version | `1.0.0` |
| `-i, --interactive` | Prompt for missing options | `false` |

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

## from-graphql

Generate an MCP server from a GraphQL SDL schema.

### Synopsis

```bash
mcp-factory from-graphql <schema-path> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `schema-path` | Path to `.graphql` schema file | Yes |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-e, --endpoint <url>` | GraphQL endpoint URL | None |
| `-o, --output <path>` | Output directory | `./servers` |
| `-n, --name <name>` | Server name | Auto from file |
| `-d, --description <desc>` | Package description | Auto-generated |
| `-g, --github-username <user>` | GitHub username for MCP Registry | None |
| `-v, --version <ver>` | Server version | `1.0.0` |
| `-i, --interactive` | Prompt for missing options | `false` |

### Examples

**Basic usage:**
```bash
mcp-factory from-graphql ./schema.graphql
```

**With endpoint and custom name:**
```bash
mcp-factory from-graphql ./schema.graphql \
  --endpoint https://api.example.com/graphql \
  --name my-graphql-server \
  --output ./servers/graphql
```

**For MCP Registry publishing:**
```bash
mcp-factory from-graphql ./schema.graphql \
  --name graphql-server \
  --github-username your-username
```

### How It Works

The GraphQL generator maps your schema to MCP tools:

| GraphQL Concept | MCP Tool |
|-----------------|----------|
| Query fields | Read-only tools |
| Mutation fields | Write tools |
| Scalar types | Zod validation schemas |
| Non-null arguments | Required tool parameters |

---

## from-ontology

Generate an MCP server from an ontology definition (RDF/OWL, JSON-LD, or custom YAML).

### Synopsis

```bash
mcp-factory from-ontology <ontology-path> [options]
```

### Arguments

| Argument | Description | Required |
|----------|-------------|----------|
| `ontology-path` | Path to ontology file (`.ttl`, `.rdf`, `.jsonld`, `.yaml`, `.yml`) | Yes |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--format <format>` | Ontology format: `rdf`, `jsonld`, `yaml` | Auto-detect |
| `-o, --output <path>` | Output directory | `./servers` |
| `-n, --name <name>` | Server name | Auto from file |
| `-d, --description <desc>` | Package description | Auto-generated |
| `-g, --github-username <user>` | GitHub username for MCP Registry | None |
| `-v, --version <ver>` | Server version | `1.0.0` |
| `-i, --interactive` | Prompt for missing options | `false` |

### Examples

**RDF/OWL Turtle file:**
```bash
mcp-factory from-ontology ./domain.ttl
```

**JSON-LD ontology:**
```bash
mcp-factory from-ontology ./schema.jsonld \
  --name knowledge-server
```

**Custom YAML with explicit format:**
```bash
mcp-factory from-ontology ./domain.yaml \
  --format yaml \
  --output ./servers/ontology
```

**For MCP Registry publishing:**
```bash
mcp-factory from-ontology ./domain.ttl \
  --name domain-server \
  --github-username your-username
```

### Supported Formats

| Format | Extensions | Description |
|--------|-----------|-------------|
| RDF/OWL | `.ttl`, `.rdf`, `.owl`, `.n3` | Turtle/RDF-XML ontology files |
| JSON-LD | `.jsonld` | JSON-LD linked data documents |
| YAML | `.yaml`, `.yml` | Custom YAML ontology format |

### How It Works

The ontology generator maps your ontology to MCP tools:

| Ontology Concept | MCP Tool |
|------------------|----------|
| Classes | CRUD tools per class |
| Data properties | Tool input parameters |
| Object properties | Relationship tools |
| Individuals | Pre-populated seed data |

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
| `-t, --transport <type>` | Transport type (stdio, http) | `stdio` |
| `-p, --port <port>` | Port for Streamable HTTP transport | `8000` |

### Examples

**Standard stdio transport:**
```bash
mcp-factory serve ./servers/my-server
```

**Streamable HTTP transport:**
```bash
mcp-factory serve ./servers/my-server \
  --transport http \
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
| `MISTRAL_API_KEY` | Mistral AI API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `GROQ_API_KEY` | Groq API key |
| `XAI_API_KEY` | xAI Grok API key |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key |
| `COHERE_API_KEY` | Cohere API key |
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
