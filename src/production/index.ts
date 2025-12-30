/**
 * Production utilities for generated MCP servers.
 *
 * Includes:
 * - Structured logging with JSON output
 * - Prometheus metrics
 * - Rate limiting
 * - Retry patterns with exponential backoff
 */

/**
 * Log levels for structured logging.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * Rate limiting backend options.
 */
export enum RateLimitBackend {
  MEMORY = 'memory', // Single-instance only
  REDIS = 'redis', // Distributed, production-ready
}

/**
 * Configuration for production features.
 */
export interface ProductionConfig {
  enableLogging: boolean;
  logLevel: LogLevel;
  logJson: boolean;

  enableMetrics: boolean;
  metricsPort: number;

  enableRateLimiting: boolean;
  rateLimitRequests: number;
  rateLimitWindowSeconds: number;
  rateLimitBackend: RateLimitBackend;
  redisUrl: string;

  enableRetries: boolean;
  maxRetries: number;
  retryBaseDelay: number;
}

/**
 * Create a default production config.
 */
export function createProductionConfig(
  overrides: Partial<ProductionConfig> = {}
): ProductionConfig {
  return {
    enableLogging: true,
    logLevel: LogLevel.INFO,
    logJson: true,

    enableMetrics: false,
    metricsPort: 9090,

    enableRateLimiting: false,
    rateLimitRequests: 100,
    rateLimitWindowSeconds: 60,
    rateLimitBackend: RateLimitBackend.MEMORY,
    redisUrl: 'redis://localhost:6379',

    enableRetries: true,
    maxRetries: 3,
    retryBaseDelay: 1.0,

    ...overrides,
  };
}

/**
 * Generate production utility code for MCP servers.
 */
export class ProductionCodeGenerator {
  config: ProductionConfig;

  constructor(config?: Partial<ProductionConfig>) {
    this.config = createProductionConfig(config);
  }

  /**
   * Generate import statements for production utilities.
   */
  generateImports(): string {
    const imports: string[] = [];

    if (this.config.enableLogging) {
      imports.push("import pino from 'pino';");
    }

    if (this.config.enableMetrics) {
      imports.push(
        "import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';",
        "import http from 'http';"
      );
    }

    if (this.config.enableRateLimiting) {
      if (this.config.rateLimitBackend === RateLimitBackend.REDIS) {
        imports.push(
          "// Redis is imported inside RedisRateLimiter to allow graceful fallback"
        );
      }
    }

    return imports.join('\n');
  }

  /**
   * Generate structured logging setup.
   */
  generateLoggingCode(): string {
    if (!this.config.enableLogging) {
      return '';
    }

    const logLevel = this.config.logLevel.toLowerCase();

    if (this.config.logJson) {
      return `
// ============== STRUCTURED LOGGING ==============

const logger = pino({
  level: '${logLevel}',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({}),
  },
  timestamp: () => \`,"timestamp":"\${new Date().toISOString()}"\`,
});

interface LogToolCallParams {
  toolName: string;
  durationMs: number;
  success: boolean;
  error?: string;
  requestId?: string;
}

function logToolCall({ toolName, durationMs, success, error, requestId }: LogToolCallParams): void {
  const extra: Record<string, unknown> = {
    tool_name: toolName,
    duration_ms: Math.round(durationMs * 100) / 100,
  };

  if (requestId) extra.request_id = requestId;

  if (error) {
    extra.error = error;
    logger.error(extra, \`Tool \${toolName} failed\`);
  } else {
    logger.info(extra, \`Tool \${toolName} completed\`);
  }
}

`;
    } else {
      return `
// ============== LOGGING ==============

const logger = pino({
  level: '${logLevel}',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

interface LogToolCallParams {
  toolName: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

function logToolCall({ toolName, durationMs, success, error }: LogToolCallParams): void {
  if (error) {
    logger.error(\`Tool \${toolName} failed after \${durationMs.toFixed(2)}ms: \${error}\`);
  } else {
    logger.info(\`Tool \${toolName} completed in \${durationMs.toFixed(2)}ms\`);
  }
}

`;
    }
  }

  /**
   * Generate Prometheus metrics code.
   */
  generateMetricsCode(): string {
    if (!this.config.enableMetrics) {
      return '';
    }

    return `
// ============== PROMETHEUS METRICS ==============

const register = new Registry();
collectDefaultMetrics({ register });

// Metrics
const TOOL_CALLS = new Counter({
  name: 'mcp_tool_calls_total',
  help: 'Total number of tool calls',
  labelNames: ['tool_name', 'status'],
  registers: [register],
});

const TOOL_DURATION = new Histogram({
  name: 'mcp_tool_duration_seconds',
  help: 'Tool call duration in seconds',
  labelNames: ['tool_name'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
  registers: [register],
});

const TOOL_ERRORS = new Counter({
  name: 'mcp_tool_errors_total',
  help: 'Total number of tool errors',
  labelNames: ['tool_name', 'error_type'],
  registers: [register],
});

async function startMetricsServer(port: number = ${this.config.metricsPort}): Promise<void> {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    logger.info(\`Metrics server started on port \${port}\`);
  });
}

interface RecordToolMetricsParams {
  toolName: string;
  durationSeconds: number;
  success: boolean;
  errorType?: string;
}

function recordToolMetrics({
  toolName,
  durationSeconds,
  success,
  errorType,
}: RecordToolMetricsParams): void {
  const status = success ? 'success' : 'error';
  TOOL_CALLS.labels({ tool_name: toolName, status }).inc();
  TOOL_DURATION.labels({ tool_name: toolName }).observe(durationSeconds);

  if (!success && errorType) {
    TOOL_ERRORS.labels({ tool_name: toolName, error_type: errorType }).inc();
  }
}

`;
  }

  /**
   * Generate rate limiting code.
   */
  generateRateLimitingCode(): string {
    if (!this.config.enableRateLimiting) {
      return '';
    }

    // Base rate limiter interface
    const baseCode = `
// ============== RATE LIMITING ==============

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

interface BaseRateLimiter {
  maxRequests: number;
  windowSeconds: number;
  isAllowed(key?: string): Promise<boolean>;
  getRemaining(key?: string): Promise<number>;
  getResetTime(key?: string): Promise<number>;
}

`;

    // In-memory implementation
    const memoryCode = `
class MemoryRateLimiter implements BaseRateLimiter {
  /**
   * In-memory rate limiter using sliding window.
   *
   * NOTE: This only works for single-instance deployments.
   * For distributed systems, use RedisRateLimiter instead.
   */

  maxRequests: number;
  windowSeconds: number;
  private requests: Map<string, number[]> = new Map();

  constructor(
    maxRequests: number = ${this.config.rateLimitRequests},
    windowSeconds: number = ${this.config.rateLimitWindowSeconds}
  ) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  async isAllowed(key: string = 'default'): Promise<boolean> {
    const now = Date.now() / 1000;
    const windowStart = now - this.windowSeconds;

    // Clean old requests
    const timestamps = this.requests.get(key) ?? [];
    const validTimestamps = timestamps.filter(t => t > windowStart);

    // Check limit
    if (validTimestamps.length >= this.maxRequests) {
      this.requests.set(key, validTimestamps);
      return false;
    }

    // Record request
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  async getRemaining(key: string = 'default'): Promise<number> {
    const now = Date.now() / 1000;
    const windowStart = now - this.windowSeconds;

    const timestamps = this.requests.get(key) ?? [];
    const validTimestamps = timestamps.filter(t => t > windowStart);
    this.requests.set(key, validTimestamps);

    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  async getResetTime(key: string = 'default'): Promise<number> {
    const timestamps = this.requests.get(key) ?? [];
    if (timestamps.length === 0) return 0;

    const oldest = Math.min(...timestamps);
    const now = Date.now() / 1000;
    return Math.max(0, oldest + this.windowSeconds - now);
  }
}

`;

    // Redis implementation (only if backend is Redis)
    let redisCode = '';
    let factoryCode = '';

    if (this.config.rateLimitBackend === RateLimitBackend.REDIS) {
      redisCode = `
class RedisRateLimiter implements BaseRateLimiter {
  /**
   * Redis-backed rate limiter for distributed deployments.
   *
   * Uses sliding window log algorithm with Redis sorted sets.
   * Supports multiple server instances sharing rate limit state.
   */

  maxRequests: number;
  windowSeconds: number;
  private redis: any;
  private keyPrefix: string;

  constructor(
    maxRequests: number = ${this.config.rateLimitRequests},
    windowSeconds: number = ${this.config.rateLimitWindowSeconds},
    redisUrl: string = '${this.config.redisUrl}',
    keyPrefix: string = 'ratelimit:'
  ) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
    this.keyPrefix = keyPrefix;

    // Dynamic import Redis
    import('redis').then(redis => {
      this.redis = redis.createClient({ url: redisUrl });
      this.redis.connect();
    });
  }

  private getRedisKey(key: string): string {
    return \`\${this.keyPrefix}\${key}\`;
  }

  async isAllowed(key: string = 'default'): Promise<boolean> {
    if (!this.redis) return true; // Fallback if Redis not ready

    const redisKey = this.getRedisKey(key);
    const now = Date.now() / 1000;
    const windowStart = now - this.windowSeconds;

    // Remove old entries
    await this.redis.zRemRangeByScore(redisKey, 0, windowStart);

    // Count current entries
    const currentCount = await this.redis.zCard(redisKey);

    if (currentCount >= this.maxRequests) {
      return false;
    }

    // Add new request with unique member
    const member = \`\${now}:\${Math.random().toString(36).slice(2, 10)}\`;
    await this.redis.zAdd(redisKey, { score: now, value: member });
    await this.redis.expire(redisKey, this.windowSeconds + 1);

    return true;
  }

  async getRemaining(key: string = 'default'): Promise<number> {
    if (!this.redis) return this.maxRequests;

    const redisKey = this.getRedisKey(key);
    const now = Date.now() / 1000;
    const windowStart = now - this.windowSeconds;

    await this.redis.zRemRangeByScore(redisKey, 0, windowStart);
    const currentCount = await this.redis.zCard(redisKey);

    return Math.max(0, this.maxRequests - currentCount);
  }

  async getResetTime(key: string = 'default'): Promise<number> {
    if (!this.redis) return 0;

    const redisKey = this.getRedisKey(key);
    const oldest = await this.redis.zRange(redisKey, 0, 0, { withScores: true });

    if (!oldest || oldest.length === 0) return 0;

    const oldestTime = oldest[0].score;
    const now = Date.now() / 1000;
    return Math.max(0, oldestTime + this.windowSeconds - now);
  }
}

`;

      factoryCode = `
function createRateLimiter(
  backend: 'memory' | 'redis' = 'redis',
  maxRequests: number = ${this.config.rateLimitRequests},
  windowSeconds: number = ${this.config.rateLimitWindowSeconds},
  redisUrl: string = '${this.config.redisUrl}'
): BaseRateLimiter {
  /**
   * Create a rate limiter with the specified backend.
   *
   * @param backend - "memory" for single-instance, "redis" for distributed
   * @param maxRequests - Maximum requests per window
   * @param windowSeconds - Window size in seconds
   * @param redisUrl - Redis connection URL (for redis backend)
   * @returns Rate limiter instance
   */
  if (backend === 'redis') {
    return new RedisRateLimiter(maxRequests, windowSeconds, redisUrl);
  }
  return new MemoryRateLimiter(maxRequests, windowSeconds);
}

// Global rate limiter instance (using Redis)
const rateLimiter = createRateLimiter('redis');

`;
    } else {
      factoryCode = `
function createRateLimiter(
  backend: 'memory' | 'redis' = 'memory',
  maxRequests: number = ${this.config.rateLimitRequests},
  windowSeconds: number = ${this.config.rateLimitWindowSeconds}
): BaseRateLimiter {
  /**
   * Create a rate limiter with the specified backend.
   *
   * NOTE: Only memory backend is configured. For distributed deployments,
   * enable Redis backend in production config.
   */
  return new MemoryRateLimiter(maxRequests, windowSeconds);
}

// Global rate limiter instance (in-memory, single-instance only)
const rateLimiter = createRateLimiter('memory');

`;
    }

    // Common check function
    const checkCode = `
interface RateLimitError {
  error: string;
  retryAfterSeconds: number;
  remaining: number;
  limit: number;
  windowSeconds: number;
}

async function checkRateLimit(key: string = 'default'): Promise<RateLimitError | null> {
  /**
   * Check rate limit and return error response if exceeded.
   *
   * @param key - Rate limit key (e.g., user ID, IP address)
   * @returns null if allowed, error object if rate limited
   */
  const allowed = await rateLimiter.isAllowed(key);
  if (!allowed) {
    return {
      error: 'Rate limit exceeded',
      retryAfterSeconds: Math.round((await rateLimiter.getResetTime(key)) * 10) / 10,
      remaining: await rateLimiter.getRemaining(key),
      limit: rateLimiter.maxRequests,
      windowSeconds: rateLimiter.windowSeconds,
    };
  }
  return null;
}

async function getRateLimitHeaders(key: string = 'default'): Promise<Record<string, string>> {
  /**
   * Get rate limit headers for HTTP responses.
   */
  const resetTime = await rateLimiter.getResetTime(key);
  return {
    'X-RateLimit-Limit': String(rateLimiter.maxRequests),
    'X-RateLimit-Remaining': String(await rateLimiter.getRemaining(key)),
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000 + resetTime)),
  };
}

`;

    return baseCode + memoryCode + redisCode + factoryCode + checkCode;
  }

  /**
   * Generate retry pattern code with exponential backoff.
   */
  generateRetryCode(): string {
    if (!this.config.enableRetries) {
      return '';
    }

    return `
// ============== RETRY PATTERNS ==============

class RetryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'RetryError';
  }
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  exponentialBase?: number;
  jitter?: boolean;
  retryableErrors?: Array<new (...args: any[]) => Error>;
}

function retryWithBackoff<T>(options: RetryOptions = {}) {
  /**
   * Decorator factory for retry with exponential backoff.
   */
  const {
    maxRetries = ${this.config.maxRetries},
    baseDelay = ${this.config.retryBaseDelay},
    maxDelay = 60.0,
    exponentialBase = 2.0,
    jitter = true,
    retryableErrors = [Error],
  } = options;

  return function decorator(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (e) {
          const error = e as Error;
          lastError = error;

          // Check if error is retryable
          const isRetryable = retryableErrors.some(
            errorClass => error instanceof errorClass
          );

          if (!isRetryable || attempt === maxRetries) {
            break;
          }

          // Calculate delay with exponential backoff
          let delay = Math.min(baseDelay * Math.pow(exponentialBase, attempt), maxDelay);

          // Add jitter (0-25% of delay)
          if (jitter) {
            delay = delay * (1 + Math.random() * 0.25);
          }

          logger.warn(
            \`Retry \${attempt + 1}/\${maxRetries} for \${propertyKey} after \${delay.toFixed(2)}s due to: \${error.message}\`
          );

          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
      }

      throw new RetryError(
        \`Failed after \${maxRetries} retries: \${lastError?.message}\`,
        lastError ?? undefined
      );
    };

    return descriptor;
  };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  /**
   * Execute a function with retry and exponential backoff.
   */
  const {
    maxRetries = ${this.config.maxRetries},
    baseDelay = ${this.config.retryBaseDelay},
    maxDelay = 60.0,
    exponentialBase = 2.0,
    jitter = true,
    retryableErrors = [Error],
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const error = e as Error;
      lastError = error;

      const isRetryable = retryableErrors.some(
        errorClass => error instanceof errorClass
      );

      if (!isRetryable || attempt === maxRetries) {
        break;
      }

      let delay = Math.min(baseDelay * Math.pow(exponentialBase, attempt), maxDelay);
      if (jitter) {
        delay = delay * (1 + Math.random() * 0.25);
      }

      logger.warn(
        \`Retry \${attempt + 1}/\${maxRetries} after \${delay.toFixed(2)}s: \${error.message}\`
      );

      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }
  }

  throw new RetryError(
    \`Failed after \${maxRetries} retries: \${lastError?.message}\`,
    lastError ?? undefined
  );
}

`;
  }

  /**
   * Generate all production utility code.
   */
  generateAll(): string {
    const parts = [
      this.generateImports(),
      '',
      this.generateLoggingCode(),
      this.generateMetricsCode(),
      this.generateRateLimitingCode(),
      this.generateRetryCode(),
    ];
    return parts.filter((part) => part).join('\n');
  }

  /**
   * Generate a wrapper function that applies all production features to a tool.
   */
  generateToolWrapper(): string {
    const features: string[] = [];

    if (this.config.enableRateLimiting) {
      features.push('rate_limit_check');
    }
    if (this.config.enableLogging || this.config.enableMetrics) {
      features.push('timing');
    }
    if (this.config.enableRetries) {
      features.push('retry');
    }

    if (features.length === 0) {
      return '';
    }

    const timingCode =
      this.config.enableLogging || this.config.enableMetrics
        ? `
    const startTime = Date.now();
    let success = true;
    let errorMsg: string | undefined;`
        : '';

    const rateLimitCode = this.config.enableRateLimiting
      ? `
    // Check rate limit
    const rateLimitError = await checkRateLimit();
    if (rateLimitError) {
      return rateLimitError;
    }`
      : '';

    const logCode = this.config.enableLogging
      ? 'logToolCall({ toolName, durationMs, success, error: errorMsg });'
      : '';

    const metricsCode = this.config.enableMetrics
      ? 'recordToolMetrics({ toolName, durationSeconds, success, errorType: errorMsg ? "Error" : undefined });'
      : '';

    const postCallCode =
      this.config.enableLogging || this.config.enableMetrics
        ? `
    } finally {
      const durationMs = Date.now() - startTime;
      const durationSeconds = durationMs / 1000;
      ${logCode}
      ${metricsCode}`
        : '';

    return `
// ============== TOOL WRAPPER ==============

function withProductionFeatures<T extends (...args: any[]) => Promise<any>>(
  toolName: string,
  fn: T
): T {
  /**
   * Wrap a tool function with production features (logging, metrics, rate limiting).
   */
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    ${timingCode}
    ${rateLimitCode}

    try {
      const result = await fn(...args);
      return result;
    } catch (e) {
      success = false;
      errorMsg = (e as Error).message;
      throw e;
    ${postCallCode}
    }
  }) as T;
}

`;
  }
}

/**
 * Generate production code to add to servers.
 */
export function generateProductionServerAdditions(
  config?: Partial<ProductionConfig>
): string {
  const generator = new ProductionCodeGenerator(config);
  return generator.generateAll() + generator.generateToolWrapper();
}
