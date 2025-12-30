# Examples

Real-world examples of using MCP Tool Factory.

## Quick Reference

| Example | Complexity | Input Type | Features |
|---------|------------|------------|----------|
| [Weather API](#weather-api) | Beginner | Natural Language | Basic generation |
| [GitHub Tools](#github-tools) | Intermediate | Natural Language | Auth, web search |
| [E-commerce CRUD](#e-commerce-crud) | Intermediate | Database | SQLite, CRUD |
| [Stripe Payments](#stripe-payments) | Intermediate | OpenAPI | API spec import |
| [Multi-Service](#multi-service-aggregator) | Advanced | Natural Language | Multiple APIs |
| [Production Server](#production-server) | Advanced | Natural Language | Full production |

---

## Weather API

A simple weather tools server for beginners.

### Generate

```bash
mcp-factory generate "Create tools for:
1. Get current weather by city name
2. Get 5-day weather forecast
3. Convert Celsius to Fahrenheit
4. Convert Fahrenheit to Celsius" \
  --name weather-server \
  --output ./servers/weather
```

### Generated Tools

```typescript
// get_current_weather - Get current weather for a city
server.tool(
  'get_current_weather',
  { city: z.string().describe('City name') },
  async ({ city }) => {
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}`
    );
    return {
      content: [{ type: 'text', text: JSON.stringify(response.data) }]
    };
  }
);

// celsius_to_fahrenheit - Convert temperature
server.tool(
  'celsius_to_fahrenheit',
  { celsius: z.number().describe('Temperature in Celsius') },
  async ({ celsius }) => {
    const fahrenheit = (celsius * 9/5) + 32;
    return {
      content: [{ type: 'text', text: JSON.stringify({ fahrenheit }) }]
    };
  }
);
```

### Usage

```bash
cd ./servers/weather
npm install
export OPENWEATHER_API_KEY=your-key
npx tsx src/index.ts
```

---

## GitHub Tools

GitHub API integration with authentication.

### Generate

```bash
mcp-factory generate "Create tools for GitHub:
1. List repositories for a user
2. Get repository details
3. List issues for a repository
4. Create a new issue
5. Get pull request details" \
  --name github-server \
  --auth GITHUB_TOKEN \
  --web-search \
  --logging
```

### Generated Server (excerpt)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import axios from 'axios';
import pino from 'pino';

const logger = pino({ level: 'info' });
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const server = new McpServer({
  name: 'github-server',
  version: '1.0.0',
});

// Authenticated GitHub API client
const github = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
  },
});

server.tool(
  'list_repos',
  { username: z.string() },
  async ({ username }) => {
    logger.info({ username }, 'Listing repos');
    const { data } = await github.get(`/users/${username}/repos`);
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);

server.tool(
  'create_issue',
  {
    owner: z.string(),
    repo: z.string(),
    title: z.string(),
    body: z.string().optional(),
  },
  async ({ owner, repo, title, body }) => {
    logger.info({ owner, repo, title }, 'Creating issue');
    const { data } = await github.post(`/repos/${owner}/${repo}/issues`, {
      title,
      body,
    });
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
  }
);
```

---

## E-commerce CRUD

Database-driven CRUD tools for an e-commerce application.

### Database Schema

```sql
-- Create the database schema
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
);
```

### Generate

```bash
mcp-factory from-database ./ecommerce.db \
  --name ecommerce-server \
  --tables users products orders order_items
```

### Generated Tools

| Table | Tools Generated |
|-------|-----------------|
| users | get_users, list_users, create_users, update_users, delete_users |
| products | get_products, list_products, create_products, update_products, delete_products |
| orders | get_orders, list_orders, create_orders, update_orders, delete_orders |
| order_items | get_order_items, list_order_items, create_order_items, update_order_items, delete_order_items |

### Usage

```bash
cd ./servers/ecommerce-server
npm install
export DATABASE_PATH=./ecommerce.db
npx tsx src/index.ts
```

---

## Stripe Payments

Generate tools from the Stripe OpenAPI specification.

### Download Spec

```bash
curl -o stripe-openapi.json https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json
```

### Generate

```bash
mcp-factory from-openapi ./stripe-openapi.json \
  --name stripe-server \
  --base-url https://api.stripe.com
```

### Generated Tools (subset)

The Stripe spec generates many tools. Key ones include:

- `create_customer` - Create a new customer
- `get_customer` - Retrieve customer details
- `list_customers` - List all customers
- `create_payment_intent` - Create a payment intent
- `confirm_payment_intent` - Confirm a payment
- `create_subscription` - Create a subscription
- `list_invoices` - List invoices

### Usage

```bash
cd ./servers/stripe-server
npm install
export STRIPE_API_KEY=sk_test_...
npx tsx src/index.ts
```

---

## Multi-Service Aggregator

Combine multiple APIs into one MCP server.

### Generate

```bash
mcp-factory generate "Create a unified tools server that:
1. Weather: Get current weather and forecasts
2. News: Search news articles by topic
3. Translation: Translate text between languages
4. Currency: Convert between currencies with live rates
5. Time: Get current time in any timezone" \
  --name multi-service \
  --web-search \
  --auth OPENWEATHER_KEY NEWS_API_KEY GOOGLE_TRANSLATE_KEY \
  --logging \
  --metrics
```

### Generated Structure

```
servers/multi-service/
├── src/
│   └── index.ts       # All 5 services integrated
├── tests/
│   └── tools.test.ts  # Tests for each service
├── package.json       # axios, pino, prom-client
├── Dockerfile
├── README.md
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Production Server

Full production-ready server with all features.

### Generate via CLI

```bash
mcp-factory generate "Create enterprise tools for:
1. User management (CRUD operations)
2. Document processing (upload, convert, extract text)
3. Notification sending (email, SMS, push)
4. Analytics tracking (events, metrics, reports)
5. Search (full-text search across documents)" \
  --name enterprise-server \
  --auth DATABASE_URL SMTP_HOST TWILIO_SID AWS_ACCESS_KEY \
  --logging \
  --metrics \
  --rate-limit 100 \
  --retries
```

### Generate via API

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent();

const server = await agent.generateFromDescription(
  `Create enterprise tools for:
  1. User management (CRUD operations)
  2. Document processing (upload, convert, extract text)
  3. Notification sending (email, SMS, push)
  4. Analytics tracking (events, metrics, reports)
  5. Search (full-text search across documents)`,
  {
    serverName: 'enterprise-server',
    webSearch: true,
    authEnvVars: ['DATABASE_URL', 'SMTP_HOST', 'TWILIO_SID', 'AWS_ACCESS_KEY'],
    productionConfig: {
      enableLogging: true,
      logLevel: 'info',
      logJson: true,
      enableMetrics: true,
      metricsPort: 9090,
      enableRateLimiting: true,
      rateLimitRequests: 100,
      rateLimitWindowSeconds: 60,
      enableRetries: true,
      maxRetries: 3,
      retryBaseDelay: 1000,
    },
  }
);

await writeServerToDirectory(server, './servers/enterprise');
```

### Generated Files

```
servers/enterprise-server/
├── src/
│   └── index.ts          # Full server with all features
├── tests/
│   └── tools.test.ts
├── package.json          # pino, prom-client, axios, etc.
├── tsconfig.json
├── Dockerfile            # Production container
├── README.md
├── skill.md
├── server.json           # MCP Registry manifest
├── EXECUTION_LOG.md      # Full generation trace
├── execution_log.json
└── .github/
    └── workflows/
        └── ci.yml        # CI/CD with Docker build
```

### Deploy

```bash
cd ./servers/enterprise-server

# Build Docker image
docker build -t enterprise-server .

# Run with environment variables
docker run -d \
  -e DATABASE_URL=postgresql://... \
  -e SMTP_HOST=smtp.example.com \
  -e TWILIO_SID=AC... \
  -e AWS_ACCESS_KEY=AKIA... \
  enterprise-server
```

---

## Running Examples

### Test with MCP Inspector

```bash
npx @anthropic-ai/mcp-inspector npx tsx ./servers/my-server/src/index.ts
```

### Configure in Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "weather": {
      "command": "npx",
      "args": ["tsx", "/path/to/servers/weather/src/index.ts"],
      "env": {
        "OPENWEATHER_API_KEY": "your-key"
      }
    },
    "github": {
      "command": "npx",
      "args": ["tsx", "/path/to/servers/github/src/index.ts"],
      "env": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}
```

---

## Next Steps

- [CLI Reference](cli-reference.md) - All CLI options
- [API Reference](api-reference.md) - Programmatic usage
- [Production Features](production.md) - Logging, metrics, etc.
- [Troubleshooting](troubleshooting.md) - Common issues
