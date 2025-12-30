# Production Features

Configure production-ready features for generated MCP servers.

## Overview

MCP Tool Factory can generate servers with enterprise-grade features:

| Feature | Library | Purpose |
|---------|---------|---------|
| Logging | pino | Structured JSON logging |
| Metrics | prom-client | Prometheus metrics |
| Rate Limiting | Custom | Request throttling |
| Retries | Custom | Exponential backoff |
| Health Check | Built-in | Readiness/liveness |

## Quick Start

### CLI

```bash
mcp-factory generate "Create API tools" \
  --logging \
  --metrics \
  --rate-limit 100 \
  --retries
```

### API

```typescript
const server = await agent.generateFromDescription('Create API tools', {
  productionConfig: {
    enableLogging: true,
    enableMetrics: true,
    enableRateLimiting: true,
    rateLimitRequests: 100,
    enableRetries: true,
  },
});
```

---

## Structured Logging

### Enable

```bash
mcp-factory generate "..." --logging
```

### Configuration

```typescript
productionConfig: {
  enableLogging: true,
  logLevel: 'info',     // debug, info, warn, error
  logJson: true,        // JSON format for production
}
```

### Generated Code

```typescript
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: { target: 'pino-pretty' },  // or JSON in production
});

server.tool('my_tool', schema, async (params) => {
  logger.info({ tool: 'my_tool', params }, 'Tool invoked');

  try {
    const result = await doWork(params);
    logger.info({ tool: 'my_tool', success: true }, 'Tool completed');
    return result;
  } catch (error) {
    logger.error({ tool: 'my_tool', error: error.message }, 'Tool failed');
    throw error;
  }
});
```

### Log Output

**Pretty format (development):**
```
[12:34:56] INFO: Tool invoked
    tool: "get_weather"
    params: {"city":"London"}
```

**JSON format (production):**
```json
{"level":30,"time":1703123456789,"tool":"get_weather","params":{"city":"London"},"msg":"Tool invoked"}
```

### Log Levels

| Level | Value | Use Case |
|-------|-------|----------|
| debug | 20 | Detailed debugging |
| info | 30 | Normal operations |
| warn | 40 | Warning conditions |
| error | 50 | Error conditions |

---

## Prometheus Metrics

### Enable

```bash
mcp-factory generate "..." --metrics
```

### Configuration

```typescript
productionConfig: {
  enableMetrics: true,
  metricsPort: 9090,  // Port for metrics endpoint
}
```

### Generated Code

```typescript
import { Counter, Histogram, Registry } from 'prom-client';

const registry = new Registry();

const toolCallCounter = new Counter({
  name: 'mcp_tool_calls_total',
  help: 'Total number of tool calls',
  labelNames: ['tool', 'status'],
  registers: [registry],
});

const toolDurationHistogram = new Histogram({
  name: 'mcp_tool_duration_seconds',
  help: 'Tool call duration in seconds',
  labelNames: ['tool'],
  registers: [registry],
});

server.tool('my_tool', schema, async (params) => {
  const end = toolDurationHistogram.startTimer({ tool: 'my_tool' });

  try {
    const result = await doWork(params);
    toolCallCounter.inc({ tool: 'my_tool', status: 'success' });
    return result;
  } catch (error) {
    toolCallCounter.inc({ tool: 'my_tool', status: 'error' });
    throw error;
  } finally {
    end();
  }
});
```

### Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `mcp_tool_calls_total` | Counter | tool, status | Total tool invocations |
| `mcp_tool_duration_seconds` | Histogram | tool | Execution time |

### Scrape Endpoint

Metrics are available at `http://localhost:9090/metrics`:

```
# HELP mcp_tool_calls_total Total number of tool calls
# TYPE mcp_tool_calls_total counter
mcp_tool_calls_total{tool="get_weather",status="success"} 42
mcp_tool_calls_total{tool="get_weather",status="error"} 3

# HELP mcp_tool_duration_seconds Tool call duration in seconds
# TYPE mcp_tool_duration_seconds histogram
mcp_tool_duration_seconds_bucket{tool="get_weather",le="0.1"} 35
mcp_tool_duration_seconds_bucket{tool="get_weather",le="0.5"} 40
mcp_tool_duration_seconds_bucket{tool="get_weather",le="1"} 42
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'mcp-server'
    static_configs:
      - targets: ['localhost:9090']
```

---

## Rate Limiting

### Enable

```bash
mcp-factory generate "..." --rate-limit 100
```

### Configuration

```typescript
productionConfig: {
  enableRateLimiting: true,
  rateLimitRequests: 100,      // Requests per window
  rateLimitWindowSeconds: 60,   // Window duration
}
```

### Generated Code

```typescript
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(key);

  if (!limit || now >= limit.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (limit.count >= 100) {
    return false;
  }

  limit.count++;
  return true;
}

server.tool('my_tool', schema, async (params) => {
  if (!checkRateLimit('global')) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'Rate limit exceeded' }) }],
      isError: true,
    };
  }

  return doWork(params);
});
```

### Rate Limit Response

When limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45
}
```

---

## Retry Logic

### Enable

```bash
mcp-factory generate "..." --retries
```

### Configuration

```typescript
productionConfig: {
  enableRetries: true,
  maxRetries: 3,           // Maximum attempts
  retryBaseDelay: 1000,    // Base delay in ms
}
```

### Generated Code

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const delay = baseDelay * Math.pow(2, attempt);  // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

server.tool('my_tool', schema, async (params) => {
  return withRetry(async () => {
    const response = await axios.get('https://api.example.com/data');
    return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
  });
});
```

### Retry Delays

With `baseDelay: 1000` and `maxRetries: 3`:

| Attempt | Delay |
|---------|-------|
| 1 | 0ms (immediate) |
| 2 | 1000ms |
| 3 | 2000ms |
| 4 | 4000ms |

---

## Health Check

### Enable

```bash
mcp-factory generate "..." --health-check
```

Enabled by default. Disable with `--no-health-check`.

### Generated Code

```typescript
server.tool(
  'health_check',
  {},
  async () => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        }),
      }],
    };
  }
);
```

### Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:34:56.789Z",
  "version": "1.0.0"
}
```

---

## Full Production Configuration

### CLI

```bash
mcp-factory generate "Create enterprise API tools" \
  --name enterprise-server \
  --logging \
  --metrics \
  --rate-limit 100 \
  --retries \
  --health-check \
  --auth API_KEY DATABASE_URL
```

### API

```typescript
const server = await agent.generateFromDescription(
  'Create enterprise API tools',
  {
    serverName: 'enterprise-server',
    authEnvVars: ['API_KEY', 'DATABASE_URL'],
    includeHealthCheck: true,
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
```

---

## Docker Deployment

Generated `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Expose metrics port
EXPOSE 9090

# Environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info

CMD ["npx", "tsx", "src/index.ts"]
```

### Build and Run

```bash
docker build -t my-mcp-server .

docker run -d \
  -p 9090:9090 \
  -e API_KEY=your-key \
  -e DATABASE_URL=postgresql://... \
  my-mcp-server
```

---

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-server
  template:
    metadata:
      labels:
        app: mcp-server
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
        - name: mcp-server
          image: my-mcp-server:latest
          ports:
            - containerPort: 9090
          env:
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: mcp-secrets
                  key: api-key
          livenessProbe:
            exec:
              command: ["node", "-e", "process.exit(0)"]
            initialDelaySeconds: 10
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "500m"
```

## Next Steps

- [Examples](examples.md) - Production examples
- [Architecture](architecture.md) - System design
- [Troubleshooting](troubleshooting.md) - Common issues
