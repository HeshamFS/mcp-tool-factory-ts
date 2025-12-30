/**
 * Server code generator for MCP Tool Factory.
 */

import Handlebars from 'handlebars';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ToolSpec } from '../models/tool-spec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Register Handlebars helpers
Handlebars.registerHelper('jsonTypeToZod', (type: string) => {
  const typeMap: Record<string, string> = {
    string: 'string',
    integer: 'number',
    number: 'number',
    boolean: 'boolean',
    array: 'array',
    object: 'object',
  };
  return typeMap[type] || 'unknown';
});

Handlebars.registerHelper('isRequired', (key: string, required: string[] | undefined) => {
  return required?.includes(key) ?? false;
});

Handlebars.registerHelper('exampleValue', (type: string) => {
  const examples: Record<string, string> = {
    string: "'example'",
    integer: '1',
    number: '1.0',
    boolean: 'true',
    array: '[]',
    object: '{}',
  };
  return examples[type] || "'value'";
});

Handlebars.registerHelper('lookup', (obj: Record<string, string>, key: string) => {
  return obj[key] || '      // TODO: Implement this tool\n      return { content: [{ type: "text", text: JSON.stringify({ error: "Not implemented" }) }] };';
});

/**
 * Production configuration for generated servers.
 */
export interface ProductionConfig {
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logJson?: boolean;
  enableMetrics?: boolean;
  metricsPort?: number;
  enableRateLimiting?: boolean;
  rateLimitRequests?: number;
  rateLimitWindowSeconds?: number;
  enableRetries?: boolean;
  maxRetries?: number;
  retryBaseDelay?: number;
}

/**
 * Generates TypeScript MCP server code from tool specifications.
 */
export class ServerGenerator {
  private serverTemplate: Handlebars.TemplateDelegate;
  private testTemplate: Handlebars.TemplateDelegate;
  private packageTemplate: Handlebars.TemplateDelegate;
  private dockerfileTemplate: Handlebars.TemplateDelegate;
  private githubActionsTemplate: Handlebars.TemplateDelegate;
  private tsconfigTemplate: Handlebars.TemplateDelegate;
  private serverJsonTemplate: Handlebars.TemplateDelegate;

  constructor() {
    // In dev: src/generators/ -> need ../templates
    // In build: dist/ -> need ./templates (bundler flattens output)
    const primaryDir = join(__dirname, '..', 'templates');
    const fallbackDir = join(__dirname, 'templates');
    const templateDir = existsSync(primaryDir) ? primaryDir : fallbackDir;

    this.serverTemplate = Handlebars.compile(
      readFileSync(join(templateDir, 'server.ts.hbs'), 'utf-8')
    );
    this.testTemplate = Handlebars.compile(
      readFileSync(join(templateDir, 'test.spec.ts.hbs'), 'utf-8')
    );
    this.packageTemplate = Handlebars.compile(
      readFileSync(join(templateDir, 'package.json.hbs'), 'utf-8')
    );
    this.dockerfileTemplate = Handlebars.compile(
      readFileSync(join(templateDir, 'Dockerfile.hbs'), 'utf-8')
    );
    this.githubActionsTemplate = Handlebars.compile(
      readFileSync(join(templateDir, 'github-actions.yml.hbs'), 'utf-8')
    );
    this.tsconfigTemplate = Handlebars.compile(
      readFileSync(join(templateDir, 'tsconfig.server.json.hbs'), 'utf-8')
    );
    this.serverJsonTemplate = Handlebars.compile(
      readFileSync(join(templateDir, 'server.json.hbs'), 'utf-8')
    );
  }

  /**
   * Generate complete MCP server code using Handlebars templates.
   */
  generateServer(
    serverName: string,
    toolSpecs: ToolSpec[],
    implementations: Record<string, string>,
    options?: {
      authEnvVars?: string[];
      includeHealthCheck?: boolean;
      productionConfig?: ProductionConfig;
    }
  ): string {
    const { authEnvVars = [], includeHealthCheck = true, productionConfig } = options ?? {};

    // Collect all dependencies from tool specs
    const allDeps = new Set<string>();
    for (const spec of toolSpecs) {
      for (const dep of spec.dependencies) {
        allDeps.add(dep);
      }
    }

    // Extract imports from implementations and clean the code
    const extractedImportStatements: string[] = [];
    const cleanedImplementations: Record<string, string> = {};

    for (const [name, impl] of Object.entries(implementations)) {
      const [imports, cleaned] = this.extractImportsFromImplementation(impl);
      extractedImportStatements.push(...imports);
      cleanedImplementations[name] = cleaned;
    }

    // Generate production code if enabled
    let prodImports = '';
    let prodLogging = '';
    let prodMetrics = '';
    let prodRateLimiting = '';
    let prodRetry = '';

    if (productionConfig) {
      const prodGen = new ProductionCodeGenerator(productionConfig);
      prodImports = prodGen.generateImports();
      prodLogging = prodGen.generateLoggingCode();
      prodMetrics = prodGen.generateMetricsCode();
      prodRateLimiting = prodGen.generateRateLimitingCode();
      prodRetry = prodGen.generateRetryCode();
    }

    // Merge and deduplicate ALL imports
    // 1. Generate dependency imports from tool specs
    const depImportStatements = this.generateDependencyImports(allDeps);
    // 2. Parse production imports
    const prodImportStatements = prodImports ? prodImports.split('\n').filter(l => l.trim()) : [];
    // 3. Combine all import statements
    const allImports = [...depImportStatements, ...extractedImportStatements, ...prodImportStatements];

    // Deduplicate by extracting the package name and keeping first occurrence
    const seenPackages = new Set<string>();
    const uniqueImports: string[] = [];

    for (const imp of allImports) {
      // Extract package name from import statement
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      const packageName = match ? match[1] : imp;

      if (!seenPackages.has(packageName)) {
        seenPackages.add(packageName);
        uniqueImports.push(imp);
      }
    }

    return this.serverTemplate({
      serverName,
      toolSpecs,
      implementations: cleanedImplementations,
      dependencyImports: uniqueImports, // All deduplicated imports go here
      extractedImports: [], // Empty - all imports now in dependencyImports
      authEnvVars,
      includeHealthCheck,
      toolCount: toolSpecs.length,
      productionImports: '', // Empty - production imports merged above
      productionLogging: prodLogging,
      productionMetrics: prodMetrics,
      productionRateLimiting: prodRateLimiting,
      productionRetry: prodRetry,
    });
  }

  /**
   * Generate Jest test code for the server.
   */
  generateTests(serverName: string, toolSpecs: ToolSpec[]): string {
    return this.testTemplate({
      serverName,
      toolSpecs,
    });
  }

  /**
   * Generate Dockerfile for the server.
   */
  generateDockerfile(
    toolSpecs: ToolSpec[],
    authEnvVars: string[] = []
  ): string {
    return this.dockerfileTemplate({
      toolSpecs,
      authEnvVars,
    });
  }

  /**
   * Generate package.json for the server.
   */
  generatePackageJson(
    serverName: string,
    toolSpecs: ToolSpec[],
    options?: {
      productionConfig?: ProductionConfig;
      githubUsername?: string;
      description?: string;
    }
  ): string {
    const { productionConfig, githubUsername, description } = options ?? {};
    const baseName = serverName.toLowerCase().replace(/\s+/g, '-');

    // Generate npm package name (scoped if github username provided)
    const npmPackageName = githubUsername
      ? `@${githubUsername}/${baseName}`
      : baseName;

    // Generate MCP name for registry (io.github.<username>/<name>)
    const mcpName = githubUsername
      ? `io.github.${githubUsername}/${baseName}`
      : `io.local/${baseName}`;

    // Collect all dependencies
    const dependencies = new Set<string>();
    for (const spec of toolSpecs) {
      for (const dep of spec.dependencies) {
        dependencies.add(dep);
      }
    }

    // Add production dependencies based on config
    if (productionConfig) {
      if (productionConfig.enableLogging) {
        dependencies.add('pino');
        dependencies.add('pino-pretty');
      }
      if (productionConfig.enableMetrics) {
        dependencies.add('prom-client');
      }
    }

    return this.packageTemplate({
      npmPackageName,
      mcpName,
      description: description ?? `MCP server: ${serverName}`,
      dependencies: [...dependencies],
    });
  }

  /**
   * Generate GitHub Actions workflow.
   */
  generateGitHubActions(
    serverName: string,
    authEnvVars: string[] = []
  ): string {
    const dockerImage = serverName.toLowerCase().replace(/\s+/g, '-');

    return this.githubActionsTemplate({
      serverName,
      authEnvVars,
      dockerImage,
    });
  }

  /**
   * Generate tsconfig.json for the server.
   */
  generateTsConfig(): string {
    return this.tsconfigTemplate({});
  }

  /**
   * Generate server.json for MCP Registry.
   *
   * For publishing to the MCP Registry, you need:
   * 1. A GitHub username for authentication (io.github.<username>/<name>)
   * 2. npm package published with matching mcpName in package.json
   */
  generateServerJson(
    serverName: string,
    toolSpecs: ToolSpec[],
    options?: {
      description?: string;
      repositoryUrl?: string;
      authEnvVars?: string[];
      githubUsername?: string;
      version?: string;
    }
  ): string {
    const {
      description,
      repositoryUrl,
      authEnvVars = [],
      githubUsername,
      version = '1.0.0',
    } = options ?? {};

    const baseName = serverName.toLowerCase().replace(/\s+/g, '-');

    // Generate MCP name for registry (io.github.<username>/<name>)
    const mcpName = githubUsername
      ? `io.github.${githubUsername}/${baseName}`
      : `io.local/${baseName}`;

    // Generate npm package name (scoped if github username provided)
    const npmPackageName = githubUsername
      ? `@${githubUsername}/${baseName}`
      : baseName;

    // Generate repository URL
    const repoUrl = repositoryUrl ?? (
      githubUsername
        ? `https://github.com/${githubUsername}/${baseName}`
        : `https://github.com/user/${baseName}`
    );

    return this.serverJsonTemplate({
      mcpName,
      npmPackageName,
      version,
      description: description ?? `MCP server: ${serverName}`,
      repositoryUrl: repoUrl,
      authEnvVars,
      toolSpecs,
    });
  }

  /**
   * Generate import statements for dependencies.
   */
  private generateDependencyImports(deps: Set<string>): string[] {
    const imports: string[] = [];

    for (const dep of [...deps].sort()) {
      // Handle common package name mappings
      if (dep === 'axios') {
        imports.push("import axios from 'axios';");
      } else if (dep === 'lodash') {
        imports.push("import _ from 'lodash';");
      } else if (dep === 'moment') {
        imports.push("import moment from 'moment';");
      } else if (dep === 'date-fns') {
        imports.push("import * as dateFns from 'date-fns';");
      } else {
        imports.push(`import ${dep.replace(/-/g, '_')} from '${dep}';`);
      }
    }

    return imports;
  }

  /**
   * Extract import statements from implementation code.
   */
  private extractImportsFromImplementation(impl: string): [string[], string] {
    const lines = impl.trim().split('\n');
    const imports: string[] = [];
    let codeStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const stripped = line.trim();

      if (stripped.startsWith('import ') || stripped.startsWith('from ')) {
        imports.push(stripped);
        codeStart = i + 1;
      } else if (stripped === '' && codeStart === i) {
        codeStart = i + 1;
      } else if (stripped.startsWith('//') && codeStart === i) {
        codeStart = i + 1;
      } else {
        break;
      }
    }

    const remaining = lines.slice(codeStart);
    return [imports, remaining.join('\n').trim()];
  }

  /**
   * Convert JSON Schema type to TypeScript type.
   */
  jsonTypeToTypeScript(jsonType: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      integer: 'number',
      number: 'number',
      boolean: 'boolean',
      array: 'unknown[]',
      object: 'Record<string, unknown>',
    };
    return typeMap[jsonType] || 'unknown';
  }
}

/**
 * Generate production feature code (logging, metrics, etc.).
 */
class ProductionCodeGenerator {
  constructor(private config: ProductionConfig) {}

  generateImports(): string {
    const imports: string[] = [];

    if (this.config.enableLogging) {
      imports.push("import pino from 'pino';");
    }
    if (this.config.enableMetrics) {
      imports.push("import { Counter, Histogram, Registry } from 'prom-client';");
    }

    return imports.join('\n');
  }

  generateLoggingCode(): string {
    if (!this.config.enableLogging) return '';

    const level = this.config.logLevel ?? 'info';
    const transport = this.config.logJson
      ? ''
      : `, transport: { target: 'pino-pretty' }`;

    return `
const logger = pino({ level: '${level}'${transport} });

function log(level: 'debug' | 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>): void {
  logger[level](data, msg);
}
`;
  }

  generateMetricsCode(): string {
    if (!this.config.enableMetrics) return '';

    return `
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
`;
  }

  generateRateLimitingCode(): string {
    if (!this.config.enableRateLimiting) return '';

    const requests = this.config.rateLimitRequests ?? 100;
    const windowSeconds = this.config.rateLimitWindowSeconds ?? 60;

    return `
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(key);

  if (!limit || now >= limit.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + ${windowSeconds * 1000} });
    return true;
  }

  if (limit.count >= ${requests}) {
    return false;
  }

  limit.count++;
  return true;
}
`;
  }

  generateRetryCode(): string {
    if (!this.config.enableRetries) return '';

    const maxRetries = this.config.maxRetries ?? 3;
    const baseDelay = this.config.retryBaseDelay ?? 1000;

    return `
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = ${maxRetries},
  baseDelay = ${baseDelay}
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}
`;
  }
}
