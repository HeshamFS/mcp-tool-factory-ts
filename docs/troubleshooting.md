# Troubleshooting

Common issues and solutions for MCP Tool Factory.

## Quick Diagnostics

Run these commands to diagnose issues:

```bash
# Check version
mcp-factory --version

# Check environment
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY
echo $GOOGLE_API_KEY

# Test provider connection
mcp-factory info

# Validate generated code
import { validateGeneratedServer } from 'mcp-tool-factory';
```

---

## Installation Issues

### Command not found: mcp-factory

**Cause:** Package not installed globally.

**Solution:**
```bash
# Install globally
npm install -g mcp-tool-factory

# Or use npx
npx mcp-tool-factory generate "..."
```

### Module import errors

**Cause:** Incompatible Node.js version.

**Solution:**
```bash
# Check Node version (requires 18+)
node --version

# Install correct version
nvm install 18
nvm use 18
```

### TypeScript errors during installation

**Cause:** Missing peer dependencies.

**Solution:**
```bash
# Install with all deps
npm install mcp-tool-factory typescript
```

---

## API Key Issues

### "API key not found"

**Cause:** Environment variable not set.

**Solution:**
```bash
# Check if set
echo $ANTHROPIC_API_KEY

# Set it (Linux/macOS)
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Set it (Windows PowerShell)
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."

# Set it (Windows CMD)
set ANTHROPIC_API_KEY=sk-ant-api03-...
```

### "Invalid API key" (Anthropic)

**Cause:** Incorrect or expired key.

**Solution:**
```bash
# Test with curl
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

If this fails, get a new key from [console.anthropic.com](https://console.anthropic.com/).

### "Incorrect API key" (OpenAI)

**Cause:** Key doesn't match format or is revoked.

**Solution:**
```bash
# Test with curl
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Get a new key from [platform.openai.com](https://platform.openai.com/api-keys).

### "API key not valid" (Google)

**Cause:** API not enabled or key revoked.

**Solution:**
```bash
# Test with curl
curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY"
```

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create new API key
3. Ensure Gemini API is enabled

---

## Generation Issues

### "Failed to parse LLM response"

**Cause:** LLM returned malformed JSON.

**Solution:**
```bash
# Try with a different model
mcp-factory generate "..." --model claude-sonnet-4-20250514

# Simplify your description
mcp-factory generate "Create a simple weather tool"
```

### Empty or minimal generated code

**Cause:** Description too vague.

**Solution:**
```bash
# Be more specific
mcp-factory generate "Create tools for:
1. Get current weather by city name using OpenWeatherMap API
2. Get 5-day forecast with temperature and conditions
3. Convert Celsius to Fahrenheit"
```

### Missing imports in generated code

**Cause:** Template or LLM issue.

**Solution:**
```typescript
// Check and add missing imports manually
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
```

### Rate limit exceeded

**Cause:** Too many API requests.

**Solution:**
```bash
# Wait and retry
sleep 60 && mcp-factory generate "..."

# Use a different provider
mcp-factory generate "..." --provider openai
```

---

## Generated Server Issues

### "Cannot find module" errors

**Cause:** Dependencies not installed.

**Solution:**
```bash
cd ./servers/my-server
npm install
```

### "tsx: command not found"

**Cause:** tsx not installed.

**Solution:**
```bash
# Install tsx
npm install -D tsx

# Or use globally
npm install -g tsx
```

### TypeScript compilation errors

**Cause:** Invalid generated TypeScript.

**Solution:**
```typescript
// Validate generated code
import { validateGeneratedServer } from 'mcp-tool-factory';

const result = await validateGeneratedServer(code);
console.log(result.errors);
```

Fix errors manually or regenerate with:
```bash
mcp-factory generate "..." --model claude-opus-4-20250514
```

### Server starts but tools don't work

**Cause:** Missing environment variables.

**Solution:**
```bash
# Check required env vars in generated README
cat ./servers/my-server/README.md

# Set required variables
export API_KEY=your-key
export DATABASE_URL=postgresql://...
```

---

## OpenAPI Issues

### "Invalid OpenAPI specification"

**Cause:** Malformed or unsupported spec.

**Solution:**
```bash
# Validate spec
npx swagger-cli validate ./api.yaml

# Check OpenAPI version (3.0+ required)
head -5 ./api.yaml
```

### "No operations found"

**Cause:** Empty paths or missing operations.

**Solution:**
Check your spec has paths with HTTP methods:
```yaml
paths:
  /users:
    get:              # Must have at least one operation
      summary: List users
```

### Authentication not working

**Cause:** Security scheme not detected.

**Solution:**
1. Verify security schemes in spec:
```yaml
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

security:
  - ApiKeyAuth: []
```

2. Set environment variable:
```bash
export API_KEY=your-key
```

---

## Database Issues

### "Database file not found" (SQLite)

**Cause:** Incorrect path.

**Solution:**
```bash
# Check file exists
ls -la ./data.db

# Use absolute path
mcp-factory from-database /full/path/to/data.db
```

### "Connection refused" (PostgreSQL)

**Cause:** Database not running or wrong credentials.

**Solution:**
```bash
# Test connection
psql "postgresql://user:pass@localhost/mydb"

# Check PostgreSQL is running
pg_isready -h localhost
```

### "Table not found"

**Cause:** Table doesn't exist in schema.

**Solution:**
```bash
# List tables (SQLite)
sqlite3 ./data.db ".tables"

# List tables (PostgreSQL)
psql -c "\dt" "postgresql://..."
```

### Type mapping issues

**Cause:** Unsupported column type.

**Solution:**
Check supported types in [Database Guide](database.md#type-mapping).

---

## CLI Issues

### Options not recognized

**Cause:** Wrong option format.

**Solution:**
```bash
# Use correct format
mcp-factory generate "..." --name my-server  # Correct
mcp-factory generate "..." -name my-server   # Wrong

# Check help
mcp-factory generate --help
```

### Output directory issues

**Cause:** Permission or path issues.

**Solution:**
```bash
# Check permissions
ls -la ./servers/

# Create directory first
mkdir -p ./servers/my-server

# Use absolute path
mcp-factory generate "..." --output /full/path/to/output
```

---

## Performance Issues

### Generation is slow

**Cause:** Large context or complex description.

**Solution:**
```bash
# Use faster model
mcp-factory generate "..." --model claude-3-5-haiku-20241022

# Simplify description
mcp-factory generate "Create a weather tool"

# Skip web search
mcp-factory generate "..." --no-web-search
```

### High token usage

**Cause:** Complex multi-tool generation.

**Solution:**
```bash
# Generate tools separately
mcp-factory generate "Create weather tool"
mcp-factory generate "Create time tool"

# Combine manually or generate all at once with simpler descriptions
```

---

## Getting Help

### Check logs

Generation logs are saved in output:
```bash
cat ./servers/my-server/EXECUTION_LOG.md
cat ./servers/my-server/execution_log.json
```

### Enable debug logging

```bash
DEBUG=mcp-factory:* mcp-factory generate "..."
```

### Report issues

1. Check existing issues: [GitHub Issues](https://github.com/HeshamFS/mcp-tool-factory-ts/issues)
2. Create new issue with:
   - Version: `mcp-factory --version`
   - Node version: `node --version`
   - Full error message
   - Steps to reproduce

### Community

- [GitHub Discussions](https://github.com/HeshamFS/mcp-tool-factory-ts/discussions)
- [MCP Discord](https://discord.gg/mcp)
