/**
 * OpenTelemetry integration for MCP servers.
 *
 * Provides distributed tracing, metrics, and structured logging
 * for production MCP server deployments.
 */

/**
 * Supported telemetry exporters.
 */
export enum TelemetryExporter {
  CONSOLE = 'console', // Debug output to console
  OTLP = 'otlp', // OpenTelemetry Protocol (default)
  JAEGER = 'jaeger', // Jaeger backend
  ZIPKIN = 'zipkin', // Zipkin backend
  AZURE = 'azure', // Azure Application Insights
}

/**
 * Configuration for OpenTelemetry integration.
 */
export interface TelemetryConfig {
  // Basic settings
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;

  // Tracing settings
  enableTracing: boolean;
  exporter: TelemetryExporter;
  endpoint: string;
  sampleRate: number; // 1.0 = 100% sampling

  // Metrics settings
  enableMetrics: boolean;
  metricsPort: number; // Prometheus metrics port

  // Logging settings
  enableLogCorrelation: boolean;

  // Azure-specific settings (only used when exporter is AZURE)
  azureConnectionString?: string;

  // Additional resource attributes
  resourceAttributes: Record<string, string>;
}

/**
 * Create a default telemetry config.
 */
export function createTelemetryConfig(
  overrides: Partial<TelemetryConfig> = {}
): TelemetryConfig {
  return {
    enabled: true,
    serviceName: 'mcp-server',
    serviceVersion: '1.0.0',

    enableTracing: true,
    exporter: TelemetryExporter.OTLP,
    endpoint: 'http://localhost:4317',
    sampleRate: 1.0,

    enableMetrics: true,
    metricsPort: 9464,

    enableLogCorrelation: true,

    resourceAttributes: {},

    ...overrides,
  };
}

/**
 * Generate OpenTelemetry instrumentation code for MCP servers.
 */
export class TelemetryCodeGenerator {
  config: TelemetryConfig;

  constructor(config?: Partial<TelemetryConfig>) {
    this.config = createTelemetryConfig(config);
  }

  /**
   * Generate import statements for telemetry.
   */
  generateImports(): string {
    if (!this.config.enabled) {
      return '';
    }

    const imports: string[] = [];

    if (this.config.enableTracing) {
      imports.push(
        "import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';",
        "import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';",
        "import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';",
        "import { Resource } from '@opentelemetry/resources';",
        "import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';"
      );

      // Exporter-specific imports
      switch (this.config.exporter) {
        case TelemetryExporter.OTLP:
          imports.push(
            "import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';"
          );
          break;
        case TelemetryExporter.JAEGER:
          imports.push("import { JaegerExporter } from '@opentelemetry/exporter-jaeger';");
          break;
        case TelemetryExporter.ZIPKIN:
          imports.push("import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';");
          break;
        case TelemetryExporter.AZURE:
          imports.push(
            "import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';"
          );
          break;
        case TelemetryExporter.CONSOLE:
          imports.push(
            "import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';"
          );
          break;
      }
    }

    if (this.config.enableMetrics) {
      imports.push(
        "import { metrics } from '@opentelemetry/api';",
        "import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';"
      );

      if (this.config.exporter === TelemetryExporter.OTLP) {
        imports.push(
          "import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';"
        );
      } else if (this.config.exporter === TelemetryExporter.CONSOLE) {
        imports.push(
          "import { ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';"
        );
      }
    }

    return imports.join('\n');
  }

  /**
   * Generate telemetry setup code.
   */
  generateSetupCode(): string {
    if (!this.config.enabled) {
      return '';
    }

    let code = `
// ============== OPENTELEMETRY SETUP ==============

function setupTelemetry(): void {
  // Create resource with service information
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: '${this.config.serviceName}',
    [SEMRESATTRS_SERVICE_VERSION]: '${this.config.serviceVersion}',
`;

    // Add custom resource attributes
    for (const [key, value] of Object.entries(this.config.resourceAttributes)) {
      code += `    '${key}': '${value}',\n`;
    }

    code += '  });\n';

    // Tracing setup
    if (this.config.enableTracing) {
      code += this.generateTracingSetup();
    }

    // Metrics setup
    if (this.config.enableMetrics) {
      code += this.generateMetricsSetup();
    }

    code += `
  console.log('OpenTelemetry instrumentation initialized');
}

// Initialize telemetry on module load
setupTelemetry();

`;
    return code;
  }

  private generateTracingSetup(): string {
    let code = '\n  // Setup tracing\n';
    code += '  const tracerProvider = new NodeTracerProvider({ resource });\n';

    // Exporter configuration
    switch (this.config.exporter) {
      case TelemetryExporter.OTLP:
        code += `  const exporter = new OTLPTraceExporter({ url: '${this.config.endpoint}' });\n`;
        break;
      case TelemetryExporter.JAEGER:
        const jaegerHost = this.config.endpoint.split('://')[1]?.split(':')[0] ?? 'localhost';
        code += `  const exporter = new JaegerExporter({
    host: '${jaegerHost}',
    port: 6831,
  });\n`;
        break;
      case TelemetryExporter.ZIPKIN:
        const zipkinEndpoint = `${this.config.endpoint}/api/v2/spans`;
        code += `  const exporter = new ZipkinExporter({ url: '${zipkinEndpoint}' });\n`;
        break;
      case TelemetryExporter.AZURE:
        code += `  const exporter = new AzureMonitorTraceExporter({
    connectionString: '${this.config.azureConnectionString ?? ''}',
  });\n`;
        break;
      case TelemetryExporter.CONSOLE:
        code += '  const exporter = new ConsoleSpanExporter();\n';
        break;
    }

    code += `  tracerProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
  tracerProvider.register();
`;
    return code;
  }

  private generateMetricsSetup(): string {
    let code = '\n  // Setup metrics\n';

    if (this.config.exporter === TelemetryExporter.OTLP) {
      code += `  const metricExporter = new OTLPMetricExporter({ url: '${this.config.endpoint}' });\n`;
    } else if (this.config.exporter === TelemetryExporter.CONSOLE) {
      code += '  const metricExporter = new ConsoleMetricExporter();\n';
    } else {
      // Use OTLP as fallback for other exporters
      code += `  const metricExporter = new OTLPMetricExporter({ url: '${this.config.endpoint}' });\n`;
    }

    code += `  const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter });
  const meterProvider = new MeterProvider({
    resource,
    readers: [metricReader],
  });
  metrics.setGlobalMeterProvider(meterProvider);
`;
    return code;
  }

  /**
   * Generate tool instrumentation utilities.
   */
  generateInstrumentationCode(): string {
    if (!this.config.enabled) {
      return '';
    }

    return `
// ============== TELEMETRY UTILITIES ==============

// Get tracer for MCP server
const tracer = trace.getTracer('mcp_server');

// Get meter for metrics
const meter = metrics.getMeter('mcp_server');

// Create metrics
const toolCallCounter = meter.createCounter('mcp.tool.calls', {
  description: 'Number of tool calls',
  unit: '1',
});

const toolDurationHistogram = meter.createHistogram('mcp.tool.duration', {
  description: 'Tool call duration',
  unit: 'ms',
});

const toolErrorCounter = meter.createCounter('mcp.tool.errors', {
  description: 'Number of tool errors',
  unit: '1',
});

interface TraceToolCallResult<T> {
  result: T;
  span: any;
}

/**
 * Trace a tool call with automatic metrics and error handling.
 */
async function traceToolCall<T>(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  return tracer.startActiveSpan(\`tool.\${toolName}\`, { kind: SpanKind.INTERNAL }, async (span) => {
    const startTime = Date.now();

    // Set input attributes
    span.setAttribute('tool.name', toolName);
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        span.setAttribute(\`tool.input.\${key}\`, value);
      }
    }

    try {
      const result = await fn();

      // Record success
      span.setStatus({ code: SpanStatusCode.OK });
      toolCallCounter.add(1, { tool: toolName, status: 'success' });

      // Add result info
      if (typeof result === 'string') {
        span.setAttribute('tool.result.length', result.length);
      } else if (typeof result === 'object' && result !== null) {
        span.setAttribute('tool.result.keys', Object.keys(result).join(','));
      }

      return result;
    } catch (error) {
      // Record error
      const err = error as Error;
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      span.recordException(err);
      toolErrorCounter.add(1, { tool: toolName, error_type: err.name });
      toolCallCounter.add(1, { tool: toolName, status: 'error' });
      throw error;
    } finally {
      // Record duration
      const durationMs = Date.now() - startTime;
      span.setAttribute('tool.duration_ms', durationMs);
      toolDurationHistogram.record(durationMs, { tool: toolName });
      span.end();
    }
  });
}

/**
 * Decorator factory to add tracing to a tool function.
 */
function instrumentTool(toolName: string) {
  return function <T extends (...args: any[]) => Promise<any>>(fn: T): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const kwargs = args[0] as Record<string, unknown>;
      return traceToolCall(toolName, kwargs, () => fn(...args));
    }) as T;
  };
}

/**
 * Synchronous version of traceToolCall.
 */
function traceToolCallSync<T>(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => T
): T {
  const span = tracer.startSpan(\`tool.\${toolName}\`, { kind: SpanKind.INTERNAL });
  const startTime = Date.now();

  // Set input attributes
  span.setAttribute('tool.name', toolName);
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      span.setAttribute(\`tool.input.\${key}\`, value);
    }
  }

  try {
    const result = fn();

    // Record success
    span.setStatus({ code: SpanStatusCode.OK });
    toolCallCounter.add(1, { tool: toolName, status: 'success' });

    if (typeof result === 'string') {
      span.setAttribute('tool.result.length', result.length);
    } else if (typeof result === 'object' && result !== null) {
      span.setAttribute('tool.result.keys', Object.keys(result).join(','));
    }

    return result;
  } catch (error) {
    const err = error as Error;
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
    toolErrorCounter.add(1, { tool: toolName, error_type: err.name });
    toolCallCounter.add(1, { tool: toolName, status: 'error' });
    throw error;
  } finally {
    const durationMs = Date.now() - startTime;
    span.setAttribute('tool.duration_ms', durationMs);
    toolDurationHistogram.record(durationMs, { tool: toolName });
    span.end();
  }
}

`;
  }

  /**
   * Generate all telemetry code.
   */
  generateAll(): string {
    if (!this.config.enabled) {
      return '// Telemetry disabled\n';
    }

    const parts = [
      this.generateImports(),
      '',
      this.generateSetupCode(),
      this.generateInstrumentationCode(),
    ];
    return parts.join('\n');
  }
}

/**
 * Generate OpenTelemetry instrumentation code.
 */
export function generateTelemetryCode(config?: Partial<TelemetryConfig>): string {
  const generator = new TelemetryCodeGenerator(config);
  return generator.generateAll();
}
