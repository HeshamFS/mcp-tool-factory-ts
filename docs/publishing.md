# Publishing to MCP Registry

Complete guide for publishing your generated MCP server to the [MCP Registry](https://registry.modelcontextprotocol.io).

## Overview

The MCP Registry is the official catalog for MCP servers. Publishing makes your server discoverable by Claude Desktop, Claude Code, and other MCP clients.

```
┌─────────────────────────────────────────────────────────┐
│                  Publishing Workflow                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   1. Generate server with --github-username              │
│                    ↓                                     │
│   2. Publish package to npm                              │
│                    ↓                                     │
│   3. Install mcp-publisher CLI                           │
│                    ↓                                     │
│   4. Authenticate with GitHub                            │
│                    ↓                                     │
│   5. Publish to MCP Registry                             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **npm account** - Create at [npmjs.com](https://www.npmjs.com/signup)
- **GitHub account** - For registry authentication
- **mcp-publisher CLI** - Install from [GitHub releases](https://github.com/modelcontextprotocol/registry/releases)

---

## Step 1: Generate with GitHub Username

Include your GitHub username when generating:

### CLI

```bash
mcp-factory generate "Create weather tools" \
  --name weather-server \
  --github-username your-github-username \
  --description "Weather tools for Claude" \
  --version 1.0.0
```

### API

```typescript
const server = await agent.generateFromDescription('Create weather tools', {
  serverName: 'weather-server',
  githubUsername: 'your-github-username',
  description: 'Weather tools for Claude',
  version: '1.0.0',
});
```

This generates:
- `package.json` with `mcpName: "io.github.your-github-username/weather-server"`
- `server.json` with proper MCP Registry format

---

## Step 2: Review Generated Files

### package.json

```json
{
  "name": "@your-github-username/weather-server",
  "version": "1.0.0",
  "description": "Weather tools for Claude",
  "mcpName": "io.github.your-github-username/weather-server",
  ...
}
```

Key fields:
- `name` - npm package name (scoped to your username)
- `mcpName` - Registry identifier (must start with `io.github.<username>/`)
- `version` - Semantic version

### server.json

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.your-github-username/weather-server",
  "description": "Weather tools for Claude",
  "version": "1.0.0",
  "repository": {
    "url": "https://github.com/your-github-username/weather-server",
    "source": "github"
  },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@your-github-username/weather-server",
      "version": "1.0.0",
      "transport": {
        "type": "stdio"
      },
      "environmentVariables": [
        {
          "name": "OPENWEATHERMAP_API_KEY",
          "description": "Required for API access",
          "required": true
        }
      ]
    }
  ],
  "tools": [
    {
      "name": "get_weather",
      "description": "Get current weather for a city"
    }
  ]
}
```

---

## Step 3: Publish to npm

```bash
cd ./servers/weather-server

# Build the package
npm install
npm run build

# Login to npm (first time only)
npm adduser

# Publish with public access (required for scoped packages)
npm publish --access public
```

### Verify npm Publication

```bash
npm view @your-github-username/weather-server
```

---

## Step 4: Install mcp-publisher

### macOS (Homebrew)

```bash
brew install modelcontextprotocol/tap/mcp-publisher
```

### Linux/Windows

Download from [GitHub Releases](https://github.com/modelcontextprotocol/registry/releases):

```bash
# Linux
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher-linux-amd64.tar.gz" | tar xz
sudo mv mcp-publisher /usr/local/bin/

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher-windows-amd64.zip" -OutFile mcp-publisher.zip
Expand-Archive mcp-publisher.zip -DestinationPath .
```

### Verify Installation

```bash
mcp-publisher --version
```

---

## Step 5: Authenticate with GitHub

```bash
mcp-publisher login github
```

This will:
1. Display a device code
2. Open GitHub device authorization page
3. Ask you to enter the code
4. Authenticate your CLI

---

## Step 6: Publish to Registry

```bash
cd ./servers/weather-server

# Publish server.json to MCP Registry
mcp-publisher publish
```

### Verify Publication

```bash
# Search the registry
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.your-github-username/weather-server"
```

---

## Complete Example

```bash
# 1. Generate with registry options
mcp-factory generate "Create a calculator with basic math operations" \
  --name calculator-mcp \
  --github-username myusername \
  --description "Basic calculator tools for Claude" \
  --version 1.0.0 \
  --output ./calculator-mcp

# 2. Navigate to output
cd ./calculator-mcp

# 3. Build and test
npm install
npm test
npm run build

# 4. Publish to npm
npm publish --access public

# 5. Authenticate (first time)
mcp-publisher login github

# 6. Publish to MCP Registry
mcp-publisher publish

# 7. Verify
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.myusername/calculator-mcp"
```

---

## Updating Your Server

When you release a new version:

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Update server.json version to match
# (manually or regenerate)

# 3. Publish to npm
npm publish

# 4. Update registry
mcp-publisher publish
```

---

## Troubleshooting

### "Registry validation failed for package"

**Cause:** Missing `mcpName` in package.json.

**Solution:** Ensure you generated with `--github-username`:
```bash
mcp-factory generate "..." --github-username your-username
```

Or manually add to package.json:
```json
{
  "mcpName": "io.github.your-username/server-name"
}
```

### "Invalid or expired Registry JWT token"

**Cause:** Authentication expired.

**Solution:**
```bash
mcp-publisher login github
```

### "You do not have permission to publish this server"

**Cause:** Server name doesn't match your GitHub namespace.

**Solution:** The `name` in server.json must start with `io.github.YOUR-USERNAME/`:
```json
{
  "name": "io.github.your-username/server-name"
}
```

### "Package not found on npm"

**Cause:** npm package not published or wrong identifier.

**Solution:**
1. Verify package exists: `npm view @your-username/server-name`
2. Ensure `identifier` in server.json matches npm package name
3. Publish to npm first: `npm publish --access public`

### "Version mismatch"

**Cause:** Version in server.json doesn't match npm package version.

**Solution:** Keep versions in sync:
```json
// package.json
{ "version": "1.2.0" }

// server.json
{ "version": "1.2.0", "packages": [{ "version": "1.2.0" }] }
```

---

## Best Practices

### Naming

- Use lowercase, hyphen-separated names: `my-awesome-server`
- Be descriptive but concise
- Avoid generic names like `tools` or `server`

### Versioning

- Follow [Semantic Versioning](https://semver.org/)
- Major: Breaking changes
- Minor: New features (backwards compatible)
- Patch: Bug fixes

### Documentation

- Include clear README with usage examples
- Document all environment variables
- Provide example configurations

### Testing

- Run tests before publishing: `npm test`
- Test the server manually: `npx tsx src/index.ts`

---

## CI/CD Publishing

Automate publishing with GitHub Actions:

```yaml
# .github/workflows/publish.yml
name: Publish to MCP Registry

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm test

      # Publish to npm
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Install mcp-publisher
      - run: |
          curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher-linux-amd64.tar.gz" | tar xz
          chmod +x mcp-publisher

      # Publish to MCP Registry
      - run: ./mcp-publisher publish
        env:
          MCP_REGISTRY_TOKEN: ${{ secrets.MCP_REGISTRY_TOKEN }}
```

**Required secrets:**
- `NPM_TOKEN` - npm automation token
- `MCP_REGISTRY_TOKEN` - MCP Registry token from `mcp-publisher login`

---

## Next Steps

- [Examples](examples.md) - See published server examples
- [API Reference](api-reference.md) - Full generation options
- [Production Features](production.md) - Add logging, metrics, etc.
