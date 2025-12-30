# OpenAPI Guide

Generate MCP servers from OpenAPI specifications.

## Overview

MCP Tool Factory can convert any OpenAPI 3.0+ specification into a fully functional MCP server. Each API endpoint becomes an MCP tool.

**Capabilities:**
- Automatic tool generation from paths/operations
- Support for all HTTP methods
- Authentication detection and configuration
- Parameter handling (path, query, body)
- Response schema mapping

## Quick Start

### Basic Usage

```bash
# From YAML file
mcp-factory from-openapi ./api.yaml

# From JSON file
mcp-factory from-openapi ./api.json

# With custom name
mcp-factory from-openapi ./api.yaml --name my-api-server
```

### With Base URL Override

```bash
mcp-factory from-openapi ./api.yaml \
  --base-url https://api.production.com/v2
```

## Supported OpenAPI Versions

| Version | Support |
|---------|---------|
| OpenAPI 3.0.x | Full |
| OpenAPI 3.1.x | Full |
| Swagger 2.0 | Not supported |

## File Formats

### JSON

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {
    "/users": {
      "get": {
        "operationId": "listUsers",
        "summary": "List all users"
      }
    }
  }
}
```

### YAML

```yaml
openapi: 3.0.0
info:
  title: My API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      summary: List all users
```

## Authentication

### API Key Authentication

**OpenAPI Spec:**
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

**Generated Code:**
```typescript
const API_KEY = process.env.API_KEY;

const client = axios.create({
  baseURL: 'https://api.example.com',
  headers: {
    'X-API-Key': API_KEY,
  },
});
```

**Usage:**
```bash
export API_KEY=your-api-key
npx tsx src/index.ts
```

### Bearer Token Authentication

**OpenAPI Spec:**
```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
```

**Generated Code:**
```typescript
const BEARER_TOKEN = process.env.BEARER_TOKEN;

const client = axios.create({
  baseURL: 'https://api.example.com',
  headers: {
    Authorization: `Bearer ${BEARER_TOKEN}`,
  },
});
```

### OAuth2 Authentication

**OpenAPI Spec:**
```yaml
components:
  securitySchemes:
    OAuth2:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/oauth/authorize
          tokenUrl: https://auth.example.com/oauth/token
          scopes:
            read: Read access
            write: Write access
```

**Generated Code:**
```typescript
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

const client = axios.create({
  baseURL: 'https://api.example.com',
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
  },
});
```

### Basic Authentication

**OpenAPI Spec:**
```yaml
components:
  securitySchemes:
    BasicAuth:
      type: http
      scheme: basic
```

**Generated Code:**
```typescript
const USERNAME = process.env.API_USERNAME;
const PASSWORD = process.env.API_PASSWORD;

const client = axios.create({
  baseURL: 'https://api.example.com',
  auth: {
    username: USERNAME,
    password: PASSWORD,
  },
});
```

### API Key Locations

| Location | OpenAPI `in` Value | Generated Header |
|----------|-------------------|------------------|
| Header | `header` | Custom header name |
| Query | `query` | Query parameter |
| Cookie | `cookie` | Cookie header |

## Parameter Handling

### Path Parameters

**OpenAPI:**
```yaml
/users/{userId}:
  get:
    operationId: getUser
    parameters:
      - name: userId
        in: path
        required: true
        schema:
          type: string
```

**Generated Tool:**
```typescript
server.tool(
  'getUser',
  { userId: z.string() },
  async ({ userId }) => {
    const { data } = await client.get(`/users/${userId}`);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);
```

### Query Parameters

**OpenAPI:**
```yaml
/users:
  get:
    operationId: listUsers
    parameters:
      - name: limit
        in: query
        schema:
          type: integer
          default: 10
      - name: offset
        in: query
        schema:
          type: integer
          default: 0
```

**Generated Tool:**
```typescript
server.tool(
  'listUsers',
  {
    limit: z.number().optional().default(10),
    offset: z.number().optional().default(0),
  },
  async ({ limit, offset }) => {
    const { data } = await client.get('/users', {
      params: { limit, offset },
    });
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);
```

### Request Body

**OpenAPI:**
```yaml
/users:
  post:
    operationId: createUser
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
              email:
                type: string
            required:
              - name
              - email
```

**Generated Tool:**
```typescript
server.tool(
  'createUser',
  {
    name: z.string(),
    email: z.string(),
  },
  async ({ name, email }) => {
    const { data } = await client.post('/users', { name, email });
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);
```

## Base URL Detection

The generator automatically detects the base URL from:

1. `--base-url` CLI option (highest priority)
2. `servers[0].url` in the spec
3. Falls back to empty string (relative URLs)

**OpenAPI:**
```yaml
servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging
```

## Operation Naming

### Using operationId

If `operationId` is provided, it becomes the tool name:

```yaml
/users:
  get:
    operationId: listUsers  # Tool name: listUsers
```

### Automatic Naming

Without `operationId`, names are generated from method and path:

| Method | Path | Generated Name |
|--------|------|----------------|
| GET | /users | get_users |
| POST | /users | post_users |
| GET | /users/{id} | get_users_by_id |
| PUT | /users/{id} | put_users_by_id |
| DELETE | /users/{id} | delete_users_by_id |

## Programmatic Usage

### Basic

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from 'mcp-tool-factory';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';

const spec = yaml.load(readFileSync('./api.yaml', 'utf-8'));
const agent = new ToolFactoryAgent({ requireLlm: false });

const server = await agent.generateFromOpenAPI(spec, {
  serverName: 'my-api',
  baseUrl: 'https://api.example.com',
});

await writeServerToDirectory(server, './servers/my-api');
```

### Using OpenAPIServerGenerator Directly

```typescript
import { OpenAPIServerGenerator } from 'mcp-tool-factory';

const spec = JSON.parse(readFileSync('./api.json', 'utf-8'));
const generator = new OpenAPIServerGenerator(spec, 'https://api.example.com');

const serverCode = generator.generateServerCode('MyAPI');
const toolSpecs = generator.getToolSpecs();
const authEnvVars = generator.getAuthEnvVars();

console.log(`Generated ${toolSpecs.length} tools`);
console.log(`Auth env vars: ${authEnvVars.join(', ')}`);
```

## Example: Petstore API

### OpenAPI Spec

```yaml
openapi: 3.0.0
info:
  title: Petstore API
  version: 1.0.0
servers:
  - url: https://petstore.example.com/api/v1

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

security:
  - ApiKeyAuth: []

paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            default: 10
      responses:
        '200':
          description: List of pets
    post:
      operationId: createPet
      summary: Create a pet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                species:
                  type: string
              required:
                - name

  /pets/{petId}:
    get:
      operationId: getPet
      summary: Get pet by ID
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
    delete:
      operationId: deletePet
      summary: Delete a pet
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: string
```

### Generate

```bash
mcp-factory from-openapi ./petstore.yaml --name petstore
```

### Generated Server

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios from 'axios';

const API_KEY = process.env.API_KEY;

const client = axios.create({
  baseURL: 'https://petstore.example.com/api/v1',
  headers: {
    'X-API-Key': API_KEY,
  },
});

const server = new McpServer({
  name: 'petstore',
  version: '1.0.0',
});

server.tool(
  'listPets',
  { limit: z.number().optional().default(10) },
  async ({ limit }) => {
    const { data } = await client.get('/pets', { params: { limit } });
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'createPet',
  {
    name: z.string(),
    species: z.string().optional(),
  },
  async ({ name, species }) => {
    const { data } = await client.post('/pets', { name, species });
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'getPet',
  { petId: z.string() },
  async ({ petId }) => {
    const { data } = await client.get(`/pets/${petId}`);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'deletePet',
  { petId: z.string() },
  async ({ petId }) => {
    const { data } = await client.delete(`/pets/${petId}`);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Troubleshooting

### "Invalid OpenAPI specification"

Ensure your spec is valid OpenAPI 3.0+:

```bash
# Validate with swagger-cli
npx swagger-cli validate ./api.yaml
```

### "No operations found"

Check that your spec has at least one path with operations:

```yaml
paths:
  /users:
    get:  # At least one operation required
      summary: List users
```

### "Authentication not working"

1. Check that security schemes are defined
2. Verify environment variable is set
3. Check the generated code for correct header/auth setup

## Next Steps

- [Database Guide](database.md) - Generate from databases
- [Examples](examples.md) - More examples
- [API Reference](api-reference.md) - Programmatic usage
