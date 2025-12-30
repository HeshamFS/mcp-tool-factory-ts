# Database Guide

Generate MCP servers with CRUD tools from database schemas.

## Overview

MCP Tool Factory can introspect SQLite and PostgreSQL databases to generate complete CRUD (Create, Read, Update, Delete) tools for each table.

**Capabilities:**
- Automatic schema introspection
- Type-safe parameter generation
- Primary key detection
- Foreign key awareness
- Health check endpoint

## Quick Start

### SQLite

```bash
mcp-factory from-database ./myapp.db
```

### PostgreSQL

```bash
mcp-factory from-database "postgresql://user:pass@localhost/mydb" \
  --type postgresql
```

### Specific Tables

```bash
mcp-factory from-database ./myapp.db \
  --tables users posts comments
```

## Supported Databases

| Database | Driver | Connection Format |
|----------|--------|-------------------|
| SQLite | better-sqlite3 | File path: `./data.db` |
| PostgreSQL | pg | URI: `postgresql://user:pass@host/db` |

## SQLite

### Basic Usage

```bash
mcp-factory from-database ./myapp.db
```

### With Specific Tables

```bash
mcp-factory from-database ./myapp.db \
  --tables users posts
```

### Custom Server Name

```bash
mcp-factory from-database ./myapp.db \
  --name my-crud-server
```

### Environment Variable

The generated server uses `DATABASE_PATH`:

```bash
export DATABASE_PATH=./myapp.db
npx tsx src/index.ts
```

## PostgreSQL

### Connection String Format

```
postgresql://[user[:password]@][host][:port]/database[?options]
```

### Examples

```bash
# Local database
mcp-factory from-database "postgresql://localhost/mydb"

# With credentials
mcp-factory from-database "postgresql://user:pass@localhost/mydb"

# Remote with SSL
mcp-factory from-database "postgresql://user:pass@db.example.com:5432/mydb?sslmode=require"
```

### Environment Variable

The generated server uses `DATABASE_URL`:

```bash
export DATABASE_URL=postgresql://user:pass@localhost/mydb
npx tsx src/index.ts
```

## Generated Tools

For each table, 5 CRUD tools plus a health check are generated:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_<table>` | Get single record | Primary key |
| `list_<table>` | List with pagination | limit, offset |
| `create_<table>` | Create new record | All non-PK columns |
| `update_<table>` | Update existing | PK + columns to update |
| `delete_<table>` | Delete record | Primary key |
| `health_check` | Connection status | None |

### Example: Users Table

For a `users` table with columns `id`, `name`, `email`:

```typescript
// get_users - Get user by ID
server.tool(
  'get_users',
  { id: z.number().describe('User ID') },
  async ({ id }) => {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return { content: [{ type: 'text', text: JSON.stringify(row) }] };
  }
);

// list_users - List users with pagination
server.tool(
  'list_users',
  {
    limit: z.number().default(100).describe('Max records to return'),
    offset: z.number().default(0).describe('Records to skip'),
  },
  async ({ limit, offset }) => {
    const rows = db.prepare('SELECT * FROM users LIMIT ? OFFSET ?').all(limit, offset);
    return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
  }
);

// create_users - Create new user
server.tool(
  'create_users',
  {
    name: z.string().describe('User name'),
    email: z.string().describe('User email'),
  },
  async ({ name, email }) => {
    const result = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run(name, email);
    return { content: [{ type: 'text', text: JSON.stringify({ id: result.lastInsertRowid }) }] };
  }
);

// update_users - Update user
server.tool(
  'update_users',
  {
    id: z.number().describe('User ID'),
    name: z.string().optional().describe('New name'),
    email: z.string().optional().describe('New email'),
  },
  async ({ id, name, email }) => {
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    params.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  }
);

// delete_users - Delete user
server.tool(
  'delete_users',
  { id: z.number().describe('User ID') },
  async ({ id }) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
  }
);
```

## Type Mapping

### SQLite Types

| SQLite Type | TypeScript Type | Zod Schema |
|-------------|-----------------|------------|
| INTEGER | number | z.number() |
| REAL | number | z.number() |
| TEXT | string | z.string() |
| BLOB | Buffer | z.any() |
| BOOLEAN | boolean | z.boolean() |

### PostgreSQL Types

| PostgreSQL Type | TypeScript Type | Zod Schema |
|-----------------|-----------------|------------|
| integer, bigint | number | z.number() |
| real, double | number | z.number() |
| varchar, text | string | z.string() |
| boolean | boolean | z.boolean() |
| json, jsonb | object | z.record(z.unknown()) |
| timestamp | string | z.string() |
| uuid | string | z.string().uuid() |

## Primary Key Handling

### Single Primary Key

Most common case - one column as primary key:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT
);
```

Generated `get_users` takes `id` parameter.

### Composite Primary Key

Multiple columns form the primary key:

```sql
CREATE TABLE order_items (
  order_id INTEGER,
  product_id INTEGER,
  quantity INTEGER,
  PRIMARY KEY (order_id, product_id)
);
```

Generated `get_order_items` takes both `order_id` and `product_id`.

### No Primary Key

Tables without explicit primary key use `rowid` (SQLite) or first column:

```sql
CREATE TABLE logs (
  message TEXT,
  timestamp DATETIME
);
```

## Programmatic Usage

### Basic

```typescript
import { ToolFactoryAgent, writeServerToDirectory } from 'mcp-tool-factory';

const agent = new ToolFactoryAgent({ requireLlm: false });

const server = await agent.generateFromDatabase('./data.db', {
  serverName: 'data-server',
  tables: ['users', 'posts'],
});

await writeServerToDirectory(server, './servers/data');
```

### Using DatabaseServerGenerator Directly

```typescript
import { DatabaseServerGenerator, DatabaseType } from 'mcp-tool-factory';

const generator = new DatabaseServerGenerator('./data.db');
await generator.introspect(['users', 'posts', 'comments']);

const serverCode = generator.generateServerCode('DataServer');
const toolSpecs = generator.getToolSpecs();

console.log(`Tables: ${generator.getTableCount()}`);
console.log(`Tools: ${toolSpecs.length}`);
```

### Using DatabaseIntrospector

```typescript
import { DatabaseIntrospector, DatabaseType } from 'mcp-tool-factory';

const introspector = new DatabaseIntrospector('./data.db', DatabaseType.SQLITE);
await introspector.connect();

const tables = await introspector.getTables();
for (const table of tables) {
  const columns = await introspector.getColumns(table);
  console.log(`${table}: ${columns.map(c => c.name).join(', ')}`);
}

await introspector.disconnect();
```

## Example: E-commerce Database

### Schema

```sql
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
  --name ecommerce-server
```

### Generated Tools (20 total)

- `get_users`, `list_users`, `create_users`, `update_users`, `delete_users`
- `get_products`, `list_products`, `create_products`, `update_products`, `delete_products`
- `get_orders`, `list_orders`, `create_orders`, `update_orders`, `delete_orders`
- `get_order_items`, `list_order_items`, `create_order_items`, `update_order_items`, `delete_order_items`

## Connection Management

### SQLite Connection Pooling

The generated server uses synchronous better-sqlite3:

```typescript
import Database from 'better-sqlite3';

const db = new Database(process.env.DATABASE_PATH);
db.pragma('journal_mode = WAL'); // Better concurrency
```

### PostgreSQL Connection Pooling

The generated server uses pg with connection pooling:

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
```

## Best Practices

### 1. Use Specific Tables

Don't generate tools for system tables:

```bash
mcp-factory from-database ./app.db \
  --tables users posts comments  # Only these tables
```

### 2. Set Environment Variables

Use environment variables for connection strings:

```bash
# SQLite
export DATABASE_PATH=./production.db

# PostgreSQL
export DATABASE_URL=postgresql://user:pass@localhost/mydb
```

### 3. Add Indexes

Ensure primary keys and frequently queried columns are indexed:

```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
```

### 4. Handle Migrations

Keep your schema in version control and use migrations:

```bash
# Example with better-sqlite3
npx better-sqlite3-migrations up
```

## Troubleshooting

### "Database file not found"

Check the path is correct:

```bash
ls -la ./data.db
```

### "Connection refused" (PostgreSQL)

1. Check PostgreSQL is running
2. Verify connection string
3. Check firewall/security groups

```bash
psql "postgresql://user:pass@localhost/mydb"
```

### "Table not found"

Verify table exists:

```bash
# SQLite
sqlite3 ./data.db ".tables"

# PostgreSQL
psql -c "\dt" "postgresql://..."
```

## Next Steps

- [OpenAPI Guide](openapi.md) - Generate from API specs
- [Examples](examples.md) - More examples
- [Production Features](production.md) - Logging, metrics
