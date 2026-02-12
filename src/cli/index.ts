/**
 * Command-line interface for MCP Tool Factory.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { fileURLToPath } from 'url';
import type { ProductionConfig } from '../generators/server.js';
import { LLMProvider } from '../config/providers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Prompt the user for input.
 */
async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const displayDefault = defaultValue ? ` ${chalk.dim(`(${defaultValue})`)}` : '';

  return new Promise((resolve) => {
    rl.question(`${chalk.cyan('?')} ${question}${displayDefault}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

/**
 * Prompt for yes/no confirmation.
 */
async function confirm(question: string, defaultValue = false): Promise<boolean> {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  const answer = await prompt(`${question} ${chalk.dim(`[${hint}]`)}`);
  if (!answer) return defaultValue;
  return answer.toLowerCase().startsWith('y');
}

// Read version from package.json
function getVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

const program = new Command();

program
  .name('mcp-factory')
  .description(
    'MCP Tool Factory - Generate universal AI tools.\n\n' +
      'Build MCP servers that work with Claude, OpenAI, Google ADK,\n' +
      'LangChain, CrewAI, and any MCP-compatible client.'
  )
  .version(getVersion());

/**
 * Display a styled panel.
 */
function panel(title: string, content: string): void {
  const border = '─'.repeat(60);
  console.log(chalk.blue(`┌${border}┐`));
  console.log(chalk.blue('│') + chalk.bold.blue(` ${title}`.padEnd(60)) + chalk.blue('│'));
  console.log(chalk.blue(`├${border}┤`));
  content.split('\n').forEach((line) => {
    console.log(chalk.blue('│') + ` ${line}`.padEnd(60) + chalk.blue('│'));
  });
  console.log(chalk.blue(`└${border}┘`));
}

/**
 * Generate command - create MCP server from natural language.
 */
program
  .command('generate')
  .description('Generate MCP server from natural language description')
  .argument('<description>', 'Natural language description of the tools you want')
  .option('-o, --output <path>', 'Output directory for generated files', './servers')
  .option('-n, --name <name>', 'Name for the MCP server', 'GeneratedToolServer')
  .option('-d, --description <desc>', 'Description for package.json and server.json')
  .option(
    '-g, --github-username <user>',
    'GitHub username for MCP Registry publishing (creates io.github.<user>/<name>)'
  )
  .option('-v, --version <ver>', 'Version for the generated server', '1.0.0')
  .option(
    '-p, --provider <provider>',
    'LLM provider (anthropic, openai, google, claude_code, mistral, deepseek, groq, xai, azure, cohere)',
    undefined
  )
  .option('-m, --model <model>', 'Model to use')
  .option('-w, --web-search', 'Search the web for API docs before generating', false)
  .option(
    '-a, --auth <vars...>',
    'Environment variables for API auth (e.g., --auth API_KEY SECRET_TOKEN)'
  )
  .option('--health-check', 'Include health check endpoint', true)
  .option('--no-health-check', 'Disable health check endpoint')
  .option('--logging', 'Include structured JSON logging', true)
  .option('--no-logging', 'Disable logging')
  .option('--metrics', 'Include Prometheus metrics endpoint', false)
  .option('--rate-limit <n>', 'Enable rate limiting with N requests per minute', parseInt)
  .option('--retries', 'Include retry patterns with exponential backoff', true)
  .option('--no-retries', 'Disable retries')
  .option('--parallel', 'Generate tool implementations in parallel', true)
  .option('--no-parallel', 'Generate tool implementations sequentially')
  .option('--concurrency <n>', 'Max concurrent LLM calls when parallel', (v) => parseInt(v, 10), 5)
  .option('--no-cache', 'Skip the LLM response cache')
  .option('--stream', 'Stream LLM output tokens as they arrive')
  .option('--budget <amount>', 'Maximum budget in USD (e.g., --budget 0.50)', parseFloat)
  .option('--compare-costs', 'Show cost comparison across providers before generating', false)
  .option('-i, --interactive', 'Prompt for missing options interactively')
  .action(async (description, options) => {
    const { ToolFactoryAgent } = await import('../agent/index.js');
    const { getDefaultConfig } = await import('../config/index.js');

    // Interactive mode: prompt for missing information
    if (options.interactive || (!options.githubUsername && !process.env.CI)) {
      console.log();
      console.log(chalk.bold.blue('MCP Tool Factory - Server Generator'));
      console.log(chalk.dim('─'.repeat(45)));
      console.log();

      // Prompt for GitHub username if not provided (required for MCP Registry)
      if (!options.githubUsername) {
        const wantsRegistry = await confirm('Do you want to publish to the MCP Registry?', true);
        if (wantsRegistry) {
          options.githubUsername = await prompt(
            'GitHub username (for io.github.<username>/<name>)',
            process.env.GITHUB_USER || process.env.USER
          );
          if (!options.githubUsername) {
            console.log(
              chalk.yellow('⚠ No GitHub username provided. Server will use local naming.')
            );
          }
        }
      }

      // Prompt for server name if using default
      if (options.name === 'GeneratedToolServer') {
        const customName = await prompt('Server name', 'GeneratedToolServer');
        if (customName) options.name = customName;
      }

      // Prompt for description if not provided
      if (!options.description) {
        options.description = await prompt(
          'Server description (optional)',
          `MCP server generated from: ${description.slice(0, 50)}...`
        );
      }

      // Prompt for version
      if (options.version === '1.0.0') {
        const customVersion = await prompt('Version', '1.0.0');
        if (customVersion) options.version = customVersion;
      }

      console.log();
    }

    // Build config - use createFactoryConfig to get correct default model for provider
    const { createFactoryConfig } = await import('../config/index.js');

    const providerMap: Record<string, LLMProvider> = {
      anthropic: LLMProvider.ANTHROPIC,
      claude_code: LLMProvider.CLAUDE_CODE,
      openai: LLMProvider.OPENAI,
      google: LLMProvider.GOOGLE,
      mistral: LLMProvider.MISTRAL,
      deepseek: LLMProvider.DEEPSEEK,
      groq: LLMProvider.GROQ,
      xai: LLMProvider.XAI,
      azure: LLMProvider.AZURE,
      cohere: LLMProvider.COHERE,
    };

    const provider = options.provider ? providerMap[options.provider.toLowerCase()] : undefined;

    const config = createFactoryConfig({
      provider,
      model: options.model,
    });

    // Build output path
    let outputPath = options.output;
    if (
      outputPath === './servers' ||
      outputPath.endsWith('/servers') ||
      outputPath.endsWith('\\servers')
    ) {
      const serverDirName = options.name.toLowerCase().replace(/[\s-]/g, '_');
      outputPath = path.join(outputPath, serverDirName);
    }

    // Build production config
    const productionConfig: ProductionConfig = {
      enableLogging: options.logging,
      enableMetrics: options.metrics,
      enableRateLimiting: options.rateLimit !== undefined,
      rateLimitRequests: options.rateLimit || 100,
      enableRetries: options.retries,
    };

    // Display status
    const prodFeatures: string[] = [];
    if (options.logging) prodFeatures.push('logging');
    if (options.metrics) prodFeatures.push('metrics');
    if (options.rateLimit) prodFeatures.push(`rate-limit(${options.rateLimit}/min)`);
    if (options.retries) prodFeatures.push('retries');

    // MCP Registry info
    const mcpName = options.githubUsername
      ? `io.github.${options.githubUsername}/${options.name.toLowerCase().replace(/\s+/g, '-')}`
      : null;

    // Parallel/cache display
    const parallelInfo = options.parallel
      ? chalk.green(`parallel (max ${options.concurrency})`)
      : chalk.dim('sequential');
    const cacheInfo = options.cache === false ? chalk.dim('disabled') : chalk.green('enabled');

    // Budget display
    const budgetInfo = options.budget
      ? chalk.yellow(`$${options.budget.toFixed(2)}`)
      : chalk.dim('none');

    panel(
      'Starting Generation',
      `${chalk.bold.blue('MCP Tool Factory')}\n\n` +
        `Generating server: ${chalk.green(options.name)}\n` +
        (mcpName ? `MCP Registry name: ${chalk.cyan(mcpName)}\n` : '') +
        `Provider: ${chalk.cyan(config.provider)}\n` +
        `Model: ${chalk.cyan(config.model)}\n` +
        `Web search: ${options.webSearch ? chalk.green('enabled') : chalk.dim('disabled')}\n` +
        `Generation: ${parallelInfo}\n` +
        `LLM cache: ${cacheInfo}\n` +
        `Budget limit: ${budgetInfo}\n` +
        `Auth env vars: ${options.auth?.length ? chalk.cyan(options.auth.join(', ')) : chalk.dim('none')}\n` +
        `Health check: ${options.healthCheck ? chalk.green('enabled') : chalk.dim('disabled')}\n` +
        `Production: ${prodFeatures.length ? chalk.cyan(prodFeatures.join(', ')) : chalk.dim('none')}\n` +
        `Output directory: ${chalk.yellow(outputPath)}`
    );

    // Show cost comparison if requested
    if (options.compareCosts) {
      const { estimateCost, formatCost } = await import('../config/pricing.js');
      const { DEFAULT_MODELS } = await import('../config/providers.js');

      // Estimate ~15K input + ~10K output tokens for a typical generation
      const estIn = 15000;
      const estOut = 10000;

      console.log();
      console.log(chalk.bold('Provider Cost Comparison') + chalk.dim(` (est. ~${(estIn / 1000).toFixed(0)}K in + ~${(estOut / 1000).toFixed(0)}K out tokens):`));

      const comparisons: Array<{ label: string; cost: number | null; selected: boolean }> = [];

      const providerEntries: Array<[string, LLMProvider]> = [
        ['anthropic', LLMProvider.ANTHROPIC],
        ['openai', LLMProvider.OPENAI],
        ['google', LLMProvider.GOOGLE],
        ['mistral', LLMProvider.MISTRAL],
        ['deepseek', LLMProvider.DEEPSEEK],
        ['groq', LLMProvider.GROQ],
        ['xai', LLMProvider.XAI],
        ['cohere', LLMProvider.COHERE],
      ];

      for (const [name, prov] of providerEntries) {
        const model = DEFAULT_MODELS[prov];
        const cost = estimateCost(model, estIn, estOut);
        comparisons.push({
          label: `${name}/${model}`,
          cost,
          selected: prov === config.provider,
        });
      }

      // Sort by cost
      comparisons.sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity));

      const cheapest = comparisons[0]?.cost;
      for (const c of comparisons) {
        const costStr = c.cost !== null ? formatCost(c.cost) : 'unknown';
        const marker = c.selected ? chalk.green(' << selected') : '';
        const cheapMarker = c.cost === cheapest && !c.selected ? chalk.cyan(' (cheapest)') : '';
        console.log(`  ${c.label.padEnd(40)} ${costStr}${marker}${cheapMarker}`);
      }
      console.log();
    }

    const spinner = ora('Initializing agent...').start();

    try {
      const agent = new ToolFactoryAgent({ config });

      if (options.webSearch) {
        spinner.text = 'Searching web for API docs...';
      }

      spinner.text = 'Extracting tool specifications...';

      // Set up streaming callback if enabled
      const onStreamToken = options.stream
        ? (token: string) => {
            // When streaming, stop spinner and write tokens directly
            if (spinner.isSpinning) {
              spinner.stop();
              console.log(chalk.dim('\n[Streaming LLM output...]'));
            }
            process.stdout.write(chalk.gray(token));
          }
        : undefined;

      const result = await agent.generateFromDescription(description, {
        serverName: options.name,
        description: options.description,
        githubUsername: options.githubUsername,
        version: options.version,
        webSearch: options.webSearch,
        authEnvVars: options.auth || [],
        includeHealthCheck: options.healthCheck,
        productionConfig,
        parallel: options.stream ? false : options.parallel, // Disable parallel when streaming
        maxConcurrency: options.concurrency,
        skipCache: options.cache === false,
        stream: options.stream,
        onStreamToken,
        budget: options.budget,
      });

      // Newline after streaming output
      if (options.stream) {
        console.log('\n');
        spinner.start();
      }

      spinner.text = 'Writing generated files...';

      // Ensure output directory exists
      fs.mkdirSync(outputPath, { recursive: true });

      // Write files
      const { writeServerToDirectory } = await import('../models/generated-server.js');
      await writeServerToDirectory(result, outputPath);

      spinner.succeed('Done!');

      // Show summary
      console.log();
      const filesList = [
        `  - ${outputPath}/src/index.ts`,
        `  - ${outputPath}/tests/tools.test.ts`,
        `  - ${outputPath}/docs/ ${chalk.cyan('(API documentation)')}`,
        `  - ${outputPath}/README.md`,
        `  - ${outputPath}/CHANGELOG.md`,
        `  - ${outputPath}/skill.md`,
        `  - ${outputPath}/Dockerfile`,
        `  - ${outputPath}/package.json`,
        `  - ${outputPath}/tsconfig.json`,
        `  - ${outputPath}/server.json ${chalk.cyan('(MCP Registry)')}`,
        `  - ${outputPath}/.github/workflows/ci.yml ${chalk.cyan('(CI/CD)')}`,
      ];

      if (result.executionLog) {
        filesList.push(
          `  - ${outputPath}/EXECUTION_LOG.md ${chalk.green('(full execution trace)')}`
        );
        filesList.push(`  - ${outputPath}/execution_log.json ${chalk.dim('(machine-readable)')}`);
      }

      // Build usage summary
      const execLog = result.executionLog;
      let usageSummary = '';
      if (execLog && (execLog.totalCost > 0 || execLog.llmCallCount > 0)) {
        usageSummary =
          `\n\n${chalk.bold('Usage:')}\n` +
          `  Provider: ${chalk.cyan(`${config.provider} (${config.model})`)}\n` +
          `  Tokens: ${chalk.yellow(execLog.totalTokensIn.toLocaleString())} in / ${chalk.yellow(execLog.totalTokensOut.toLocaleString())} out\n` +
          `  LLM Calls: ${chalk.yellow(String(execLog.llmCallCount))}\n` +
          `  Estimated Cost: ${chalk.green(`$${execLog.totalCost.toFixed(4)}`)}`;

        // Per-phase breakdown
        if (execLog.costBreakdown.length > 0) {
          usageSummary += '\n\n' + chalk.bold('Cost Breakdown:');
          for (const entry of execLog.costBreakdown) {
            const phaseName = entry.phase.replace(/_/g, ' ');
            usageSummary += `\n  ${phaseName.padEnd(22)} $${entry.cost.toFixed(4)}  (${entry.calls} call${entry.calls !== 1 ? 's' : ''})`;
          }
        }
      }

      panel(
        'Generation Complete',
        `${chalk.bold.green('Successfully generated MCP server!')}\n\n` +
          `${chalk.bold('Tools created:')}\n` +
          result.toolSpecs.map((spec) => `  - ${spec.name}: ${spec.description}`).join('\n') +
          usageSummary +
          `\n\n${chalk.bold('Files generated:')}\n` +
          filesList.join('\n')
      );

      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  1. cd ${outputPath}`);
      console.log('  2. npm install');
      console.log('  3. npx tsx src/index.ts');
      console.log();
      console.log(chalk.dim('Or add to Claude Code config:'));
      const serverName = options.name.toLowerCase();
      const serverPath = `${outputPath}/src/index.ts`;
      console.log(
        `  {"mcpServers": {"${serverName}": {"command": "npx", "args": ["tsx", "${serverPath}"]}}}`
      );

      // Registry publishing instructions
      if (mcpName) {
        console.log();
        console.log(chalk.bold.blue('Registry Publishing:'));
        console.log(chalk.dim('  To publish your MCP server to the registry:'));
        console.log('  1. npm publish --access public');
        console.log('  2. brew install modelcontextprotocol/tap/mcp-publisher');
        console.log('  3. mcp-publisher login github');
        console.log('  4. mcp-publisher publish');
        console.log();
        console.log(chalk.dim(`  Registry URL: https://registry.modelcontextprotocol.io/servers/${mcpName}`));
      }
    } catch (error) {
      spinner.fail('Generation failed');
      const { BudgetExceededError } = await import('../agent/agent.js');
      if (error instanceof BudgetExceededError) {
        console.error(chalk.yellow(`\nBudget exceeded: ${error.message}`));
        console.error(chalk.dim('Use --budget <amount> to set a higher limit, or remove the flag.'));
      } else {
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
      process.exit(1);
    }
  });

/**
 * from-openapi command - generate MCP server from OpenAPI spec.
 */
program
  .command('from-openapi')
  .description('Generate MCP server from OpenAPI specification')
  .argument('<openapi-path>', 'Path to OpenAPI spec file (JSON or YAML)')
  .option('-u, --base-url <url>', 'Base URL for the API (auto-detected from spec if not provided)')
  .option('-o, --output <path>', 'Output directory for generated files', './servers')
  .option('-n, --name <name>', 'Name for the MCP server (auto-generated from spec if not provided)')
  .option('-d, --description <desc>', 'Description for package.json and server.json')
  .option('-g, --github-username <user>', 'GitHub username for MCP Registry publishing')
  .option('-v, --version <ver>', 'Version for the generated server', '1.0.0')
  .option('-i, --interactive', 'Prompt for missing options interactively')
  .action(async (openapiPath, options) => {
    const { ToolFactoryAgent } = await import('../agent/index.js');
    const { OpenAPIServerGenerator } = await import('../openapi/index.js');

    // Check file exists
    if (!fs.existsSync(openapiPath)) {
      console.error(chalk.red(`Error: File not found: ${openapiPath}`));
      process.exit(1);
    }

    // Load OpenAPI spec
    let spec: Record<string, unknown>;
    const content = fs.readFileSync(openapiPath, 'utf-8');

    if (openapiPath.endsWith('.yaml') || openapiPath.endsWith('.yml')) {
      // Dynamic import for yaml
      const yaml = await import('js-yaml');
      spec = yaml.load(content) as Record<string, unknown>;
    } else {
      spec = JSON.parse(content);
    }

    // Parse spec for display
    const info = (spec.info as Record<string, unknown>) || {};
    const servers = (spec.servers as Array<{ url: string }>) || [];
    const detectedUrl = servers[0]?.url || 'not found';
    const effectiveUrl = options.baseUrl || detectedUrl;

    // Auto-generate name from spec if not provided
    let serverName = options.name;
    if (!serverName) {
      const apiTitle = (info.title as string) || 'API';
      serverName = apiTitle.replace(/[\s-]/g, '').slice(0, 30) + 'Server';
    }

    // Interactive mode: prompt for missing information
    if (options.interactive || (!options.githubUsername && !process.env.CI)) {
      console.log();
      console.log(chalk.bold.blue('MCP Tool Factory - OpenAPI Server Generator'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log();

      // Prompt for GitHub username if not provided (required for MCP Registry)
      if (!options.githubUsername) {
        const wantsRegistry = await confirm('Do you want to publish to the MCP Registry?', true);
        if (wantsRegistry) {
          options.githubUsername = await prompt(
            'GitHub username (for io.github.<username>/<name>)',
            process.env.GITHUB_USER || process.env.USER
          );
          if (!options.githubUsername) {
            console.log(
              chalk.yellow('⚠ No GitHub username provided. Server will use local naming.')
            );
          }
        }
      }

      // Prompt for server name
      const customName = await prompt('Server name', serverName);
      if (customName) serverName = customName;

      // Prompt for description if not provided
      if (!options.description) {
        options.description = await prompt(
          'Server description (optional)',
          (info.description as string) || `MCP server for ${info.title || 'API'}`
        );
      }

      // Prompt for version
      if (options.version === '1.0.0') {
        const customVersion = await prompt('Version', (info.version as string) || '1.0.0');
        if (customVersion) options.version = customVersion;
      }

      console.log();
    }

    // Build output path
    let outputPath = options.output;
    if (
      outputPath === './servers' ||
      outputPath.endsWith('/servers') ||
      outputPath.endsWith('\\servers')
    ) {
      const serverDirName = serverName.toLowerCase().replace(/[\s-]/g, '_');
      outputPath = path.join(outputPath, serverDirName);
    }

    // Detect auth type
    const generator = new OpenAPIServerGenerator(spec, options.baseUrl);
    const authEnvVars = generator.getAuthEnvVars();
    const authType = authEnvVars.length > 0 ? authEnvVars[0] : 'none detected';

    panel(
      'OpenAPI to MCP',
      `${chalk.bold.blue('MCP Tool Factory - OpenAPI')}\n\n` +
        `${chalk.bold('Spec:')} ${chalk.green(openapiPath)}\n` +
        `${chalk.bold('API Title:')} ${info.title || 'Unknown'}\n` +
        `${chalk.bold('API Version:')} ${info.version || 'Unknown'}\n` +
        `${chalk.bold('Base URL:')} ${chalk.yellow(effectiveUrl)}\n` +
        `${chalk.bold('Auth Type:')} ${chalk.cyan(authType)}\n` +
        `${chalk.bold('Server Name:')} ${chalk.green(serverName)}\n` +
        `${chalk.bold('Output:')} ${chalk.yellow(outputPath)}`
    );

    const spinner = ora('Parsing OpenAPI specification...').start();

    try {
      // OpenAPI generation doesn't need LLM - it's deterministic
      const agent = new ToolFactoryAgent({ requireLlm: false });

      spinner.text = 'Generating MCP server code...';
      const result = await agent.generateFromOpenAPI(spec, {
        baseUrl: options.baseUrl,
        serverName,
        description: options.description,
        githubUsername: options.githubUsername,
        version: options.version,
      });

      spinner.text = 'Writing files...';

      // Ensure output directory exists
      fs.mkdirSync(outputPath, { recursive: true });

      // Write files
      const { writeServerToDirectory } = await import('../models/generated-server.js');
      await writeServerToDirectory(result, outputPath);

      spinner.succeed('Done!');

      // Show summary
      console.log();
      panel(
        'Generation Complete',
        `${chalk.bold.green('Successfully generated MCP server!')}\n\n` +
          `${chalk.bold('Endpoints converted:')} ${result.toolSpecs.length}\n\n` +
          `${chalk.bold('Tools:')}\n` +
          result.toolSpecs
            .slice(0, 10)
            .map((spec) => `  - ${spec.name}`)
            .join('\n') +
          (result.toolSpecs.length > 10 ? `\n  ... and ${result.toolSpecs.length - 10} more` : '')
      );

      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  1. cd ${outputPath}`);
      if (authEnvVars.length > 0) {
        console.log(`  2. export ${authEnvVars[0]}=your_api_key`);
        console.log('  3. npm install');
        console.log('  4. npx tsx src/index.ts');
      } else {
        console.log('  2. npm install');
        console.log('  3. npx tsx src/index.ts');
      }

      // Registry publishing instructions
      if (options.githubUsername) {
        const mcpNameOpenApi = `io.github.${options.githubUsername}/${serverName.toLowerCase().replace(/\s+/g, '-')}`;
        console.log();
        console.log(chalk.bold.blue('Registry Publishing:'));
        console.log(chalk.dim('  To publish your MCP server to the registry:'));
        console.log('  1. npm publish --access public');
        console.log('  2. brew install modelcontextprotocol/tap/mcp-publisher');
        console.log('  3. mcp-publisher login github');
        console.log('  4. mcp-publisher publish');
        console.log();
        console.log(chalk.dim(`  Registry URL: https://registry.modelcontextprotocol.io/servers/${mcpNameOpenApi}`));
      }
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * from-database command - generate MCP server from database schema.
 */
program
  .command('from-database')
  .description('Generate MCP server with CRUD tools from a database')
  .argument('<database-path>', 'Path to SQLite database file or PostgreSQL connection string')
  .option('-t, --type <type>', 'Database type (sqlite, postgresql)', 'sqlite')
  .option('-o, --output <path>', 'Output directory for generated files', './servers')
  .option('-n, --name <name>', 'Name for the MCP server (auto-generated if not provided)')
  .option('-d, --description <desc>', 'Description for package.json and server.json')
  .option('-g, --github-username <user>', 'GitHub username for MCP Registry publishing')
  .option('-v, --version <ver>', 'Version for the generated server', '1.0.0')
  .option('-T, --tables <tables...>', 'Specific tables to include (default: all tables)')
  .option('-i, --interactive', 'Prompt for missing options interactively')
  .action(async (databasePath, options) => {
    const { DatabaseServerGenerator, DatabaseType } = await import('../database/index.js');
    const { ServerGenerator } = await import('../generators/server.js');
    const { DocsGenerator } = await import('../generators/docs.js');
    const { TestsGenerator } = await import('../generators/tests.js');
    const { createGeneratedServer } = await import('../models/generated-server.js');
    const { writeServerToDirectory } = await import('../models/generated-server.js');

    // Parse database type
    const dbType = options.type === 'postgresql' ? DatabaseType.POSTGRESQL : DatabaseType.SQLITE;

    // Interactive mode: prompt for missing information
    if (options.interactive || (!options.githubUsername && !process.env.CI)) {
      console.log();
      console.log(chalk.bold.blue('MCP Tool Factory - Database Server Generator'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log();

      // Prompt for GitHub username if not provided (required for MCP Registry)
      if (!options.githubUsername) {
        const wantsRegistry = await confirm('Do you want to publish to the MCP Registry?', true);
        if (wantsRegistry) {
          options.githubUsername = await prompt(
            'GitHub username (for io.github.<username>/<name>)',
            process.env.GITHUB_USER || process.env.USER
          );
          if (!options.githubUsername) {
            console.log(
              chalk.yellow('⚠ No GitHub username provided. Server will use local naming.')
            );
          }
        }
      }

      // Prompt for description if not provided
      if (!options.description) {
        options.description = await prompt(
          'Server description (optional)',
          `Database CRUD server for ${path.basename(databasePath)}`
        );
      }

      // Prompt for version
      if (options.version === '1.0.0') {
        const customVersion = await prompt('Version', '1.0.0');
        if (customVersion) options.version = customVersion;
      }

      console.log();
    }

    // Auto-generate name
    let serverName = options.name;
    if (!serverName) {
      let dbName: string;
      if (dbType === DatabaseType.SQLITE) {
        dbName = path.basename(databasePath, path.extname(databasePath));
      } else {
        // Extract database name from connection string
        dbName = databasePath.split('/').pop()?.split('?')[0] || 'database';
      }
      serverName =
        dbName
          .split(/[-_]/)
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join('') + 'Server';
    }

    // Build output path
    let outputPath = options.output;
    if (
      outputPath === './servers' ||
      outputPath.endsWith('/servers') ||
      outputPath.endsWith('\\servers')
    ) {
      const serverDirName = serverName.toLowerCase().replace(/[\s-]/g, '_');
      outputPath = path.join(outputPath, serverDirName);
    }

    // Determine auth env var based on database type
    const authEnvVars = dbType === DatabaseType.POSTGRESQL ? ['DATABASE_URL'] : ['DATABASE_PATH'];

    panel(
      'Database to MCP',
      `${chalk.bold.blue('MCP Tool Factory - Database')}\n\n` +
        `${chalk.bold('Database:')} ${chalk.green(databasePath)}\n` +
        `${chalk.bold('Type:')} ${chalk.cyan(options.type)}\n` +
        `${chalk.bold('Server Name:')} ${chalk.green(serverName)}\n` +
        `${chalk.bold('Output:')} ${chalk.yellow(outputPath)}`
    );

    const spinner = ora('Introspecting database schema...').start();

    try {
      // Create database generator and introspect
      const dbGenerator = new DatabaseServerGenerator(databasePath);
      await dbGenerator.introspect(options.tables);

      spinner.text = 'Generating server code...';
      const serverCode = dbGenerator.generateServerCode(serverName);
      const toolSpecs = dbGenerator.getToolSpecs();

      // Initialize shared generators
      const serverGenerator = new ServerGenerator();
      const docsGenerator = new DocsGenerator();
      const testsGenerator = new TestsGenerator();

      spinner.text = 'Generating all artifacts...';

      const serverDesc = options.description ?? `Database CRUD server for ${serverName}`;

      // Create GeneratedServer with all artifacts (same pattern as OpenAPI and generate)
      const result = createGeneratedServer({
        name: serverName,
        serverCode,
        toolSpecs,
        testCode: testsGenerator.generateTestFile(serverName, toolSpecs),
        dockerfile: serverGenerator.generateDockerfile(toolSpecs, authEnvVars),
        readme: docsGenerator.generateReadme(serverName, toolSpecs, { authEnvVars }),
        skillFile: docsGenerator.generateSkill(serverName, toolSpecs),
        packageJson: serverGenerator.generatePackageJson(serverName, toolSpecs, {
          githubUsername: options.githubUsername,
          description: serverDesc,
          version: options.version,
        }),
        tsconfigJson: serverGenerator.generateTsConfig(),
        githubActions: serverGenerator.generateGitHubActions(serverName, authEnvVars),
        serverJson: serverGenerator.generateServerJson(serverName, toolSpecs, {
          authEnvVars,
          githubUsername: options.githubUsername,
          version: options.version,
          description: serverDesc,
        }),
        changelog: docsGenerator.generateChangelog(serverName, toolSpecs, options.version),
        toolsSpec: docsGenerator.generateToolsSpec(serverName, toolSpecs),
        apiDocsIndex: docsGenerator.generateApiDocsIndex(serverName, toolSpecs),
      });

      spinner.text = 'Writing files...';

      // Write all files using shared utility
      await writeServerToDirectory(result, outputPath);

      spinner.succeed('Done!');

      // Show summary
      console.log();
      const filesList = [
        `  - ${outputPath}/src/index.ts`,
        `  - ${outputPath}/tests/tools.test.ts`,
        `  - ${outputPath}/docs/ ${chalk.cyan('(API documentation)')}`,
        `  - ${outputPath}/README.md`,
        `  - ${outputPath}/CHANGELOG.md`,
        `  - ${outputPath}/skill.md`,
        `  - ${outputPath}/Dockerfile`,
        `  - ${outputPath}/package.json`,
        `  - ${outputPath}/tsconfig.json`,
        `  - ${outputPath}/server.json ${chalk.cyan('(MCP Registry)')}`,
        `  - ${outputPath}/.github/workflows/ci.yml ${chalk.cyan('(CI/CD)')}`,
      ];

      panel(
        'Generation Complete',
        `${chalk.bold.green('Successfully generated MCP server!')}\n\n` +
          `${chalk.bold('Tables introspected:')} ${dbGenerator.getTableCount()}\n` +
          `${chalk.bold('Tools generated:')} ${toolSpecs.length}\n\n` +
          `${chalk.bold('Tools:')}\n` +
          toolSpecs
            .slice(0, 10)
            .map((spec) => `  - ${spec.name}`)
            .join('\n') +
          (toolSpecs.length > 10 ? `\n  ... and ${toolSpecs.length - 10} more` : '') +
          `\n\n${chalk.bold('Files generated:')}\n` +
          filesList.join('\n')
      );

      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  1. cd ${outputPath}`);
      if (dbType === DatabaseType.POSTGRESQL) {
        console.log('  2. export DATABASE_URL=postgresql://user:pass@host/db');
      } else {
        console.log(`  2. export DATABASE_PATH=${databasePath}`);
      }
      console.log('  3. npm install');
      console.log('  4. npx tsx src/index.ts');

      // Registry publishing instructions
      if (options.githubUsername) {
        const mcpNameDb = `io.github.${options.githubUsername}/${serverName.toLowerCase().replace(/\s+/g, '-')}`;
        console.log();
        console.log(chalk.bold.blue('Registry Publishing:'));
        console.log(chalk.dim('  To publish your MCP server to the registry:'));
        console.log('  1. npm publish --access public');
        console.log('  2. brew install modelcontextprotocol/tap/mcp-publisher');
        console.log('  3. mcp-publisher login github');
        console.log('  4. mcp-publisher publish');
        console.log();
        console.log(chalk.dim(`  Registry URL: https://registry.modelcontextprotocol.io/servers/${mcpNameDb}`));
      }
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * from-graphql command - generate MCP server from GraphQL schema.
 */
program
  .command('from-graphql')
  .description('Generate MCP server from GraphQL SDL schema')
  .argument('<schema-path>', 'Path to .graphql schema file')
  .option('-e, --endpoint <url>', 'GraphQL endpoint URL')
  .option('-o, --output <path>', 'Output directory for generated files', './servers')
  .option('-n, --name <name>', 'Name for the MCP server (auto-generated if not provided)')
  .option('-d, --description <desc>', 'Description for package.json and server.json')
  .option('-g, --github-username <user>', 'GitHub username for MCP Registry publishing')
  .option('-v, --version <ver>', 'Version for the generated server', '1.0.0')
  .option('-i, --interactive', 'Prompt for missing options interactively')
  .action(async (schemaPath, options) => {
    const { ToolFactoryAgent } = await import('../agent/index.js');

    // Check file exists
    if (!fs.existsSync(schemaPath)) {
      console.error(chalk.red(`Error: File not found: ${schemaPath}`));
      process.exit(1);
    }

    // Load schema
    const schemaString = fs.readFileSync(schemaPath, 'utf-8');

    // Auto-generate name from file
    let serverName = options.name;
    if (!serverName) {
      const baseName = path.basename(schemaPath, path.extname(schemaPath));
      serverName =
        baseName
          .split(/[-_]/)
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join('') + 'Server';
    }

    // Interactive mode: prompt for missing information
    if (options.interactive || (!options.githubUsername && !process.env.CI)) {
      console.log();
      console.log(chalk.bold.blue('MCP Tool Factory - GraphQL Server Generator'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log();

      // Prompt for GitHub username if not provided (required for MCP Registry)
      if (!options.githubUsername) {
        const wantsRegistry = await confirm('Do you want to publish to the MCP Registry?', true);
        if (wantsRegistry) {
          options.githubUsername = await prompt(
            'GitHub username (for io.github.<username>/<name>)',
            process.env.GITHUB_USER || process.env.USER
          );
          if (!options.githubUsername) {
            console.log(
              chalk.yellow('⚠ No GitHub username provided. Server will use local naming.')
            );
          }
        }
      }

      // Prompt for server name
      const customName = await prompt('Server name', serverName);
      if (customName) serverName = customName;

      // Prompt for description if not provided
      if (!options.description) {
        options.description = await prompt(
          'Server description (optional)',
          `GraphQL MCP server for ${path.basename(schemaPath)}`
        );
      }

      // Prompt for version
      if (options.version === '1.0.0') {
        const customVersion = await prompt('Version', '1.0.0');
        if (customVersion) options.version = customVersion;
      }

      console.log();
    }

    // Build output path
    let outputPath = options.output;
    if (
      outputPath === './servers' ||
      outputPath.endsWith('/servers') ||
      outputPath.endsWith('\\servers')
    ) {
      const serverDirName = serverName.toLowerCase().replace(/[\s-]/g, '_');
      outputPath = path.join(outputPath, serverDirName);
    }

    panel(
      'GraphQL to MCP',
      `${chalk.bold.blue('MCP Tool Factory - GraphQL')}\n\n` +
        `${chalk.bold('Schema:')} ${chalk.green(schemaPath)}\n` +
        (options.endpoint ? `${chalk.bold('Endpoint:')} ${chalk.yellow(options.endpoint)}\n` : '') +
        `${chalk.bold('Server Name:')} ${chalk.green(serverName)}\n` +
        `${chalk.bold('Output:')} ${chalk.yellow(outputPath)}`
    );

    const spinner = ora('Parsing GraphQL schema...').start();

    try {
      // GraphQL generation doesn't need LLM - it's deterministic
      const agent = new ToolFactoryAgent({ requireLlm: false });

      spinner.text = 'Generating MCP server code...';
      const result = await agent.generateFromGraphQL(schemaString, {
        endpoint: options.endpoint,
        serverName,
        description: options.description,
        githubUsername: options.githubUsername,
        version: options.version,
      });

      spinner.text = 'Writing files...';

      // Ensure output directory exists
      fs.mkdirSync(outputPath, { recursive: true });

      // Write files
      const { writeServerToDirectory } = await import('../models/generated-server.js');
      await writeServerToDirectory(result, outputPath);

      spinner.succeed('Done!');

      // Show summary
      console.log();
      panel(
        'Generation Complete',
        `${chalk.bold.green('Successfully generated MCP server!')}\n\n` +
          `${chalk.bold('Tools generated:')} ${result.toolSpecs.length}\n\n` +
          `${chalk.bold('Tools:')}\n` +
          result.toolSpecs
            .slice(0, 10)
            .map((spec) => `  - ${spec.name}`)
            .join('\n') +
          (result.toolSpecs.length > 10 ? `\n  ... and ${result.toolSpecs.length - 10} more` : '')
      );

      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  1. cd ${outputPath}`);
      if (options.endpoint) {
        console.log(`  2. export GRAPHQL_ENDPOINT=${options.endpoint}`);
      } else {
        console.log('  2. export GRAPHQL_ENDPOINT=https://your-api.com/graphql');
      }
      console.log('  3. export GRAPHQL_AUTH_TOKEN=your_token  # if needed');
      console.log('  4. npm install');
      console.log('  5. npx tsx src/index.ts');

      // Registry publishing instructions
      if (options.githubUsername) {
        const mcpNameGql = `io.github.${options.githubUsername}/${serverName.toLowerCase().replace(/\s+/g, '-')}`;
        console.log();
        console.log(chalk.bold.blue('Registry Publishing:'));
        console.log(chalk.dim('  To publish your MCP server to the registry:'));
        console.log('  1. npm publish --access public');
        console.log('  2. brew install modelcontextprotocol/tap/mcp-publisher');
        console.log('  3. mcp-publisher login github');
        console.log('  4. mcp-publisher publish');
        console.log();
        console.log(chalk.dim(`  Registry URL: https://registry.modelcontextprotocol.io/servers/${mcpNameGql}`));
      }
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * from-ontology command - generate MCP server from ontology definition.
 */
program
  .command('from-ontology')
  .description('Generate MCP server from an ontology (RDF/OWL, JSON-LD, or custom YAML)')
  .argument('<ontology-path>', 'Path to ontology file (.ttl, .rdf, .jsonld, .yaml, .yml)')
  .option('--format <format>', 'Ontology format: rdf, jsonld, yaml (auto-detected if not provided)')
  .option('-o, --output <path>', 'Output directory for generated files', './servers')
  .option('-n, --name <name>', 'Name for the MCP server (auto-generated if not provided)')
  .option('-d, --description <desc>', 'Description for package.json and server.json')
  .option('-g, --github-username <user>', 'GitHub username for MCP Registry publishing')
  .option('-v, --version <ver>', 'Version for the generated server', '1.0.0')
  .option('-i, --interactive', 'Prompt for missing options interactively')
  .action(async (ontologyPath, options) => {
    const { ToolFactoryAgent } = await import('../agent/index.js');

    // Check file exists
    if (!fs.existsSync(ontologyPath)) {
      console.error(chalk.red(`Error: File not found: ${ontologyPath}`));
      process.exit(1);
    }

    // Read ontology content
    const content = fs.readFileSync(ontologyPath, 'utf-8');

    // Auto-detect format from file extension if not provided
    let format = options.format as 'rdf' | 'jsonld' | 'yaml' | undefined;
    if (!format) {
      const ext = path.extname(ontologyPath).toLowerCase();
      if (ext === '.ttl' || ext === '.rdf' || ext === '.owl' || ext === '.n3') {
        format = 'rdf';
      } else if (ext === '.jsonld') {
        format = 'jsonld';
      } else if (ext === '.yaml' || ext === '.yml') {
        format = 'yaml';
      }
    }

    // Auto-generate name from file if not provided
    let serverName = options.name;
    if (!serverName) {
      const baseName = path.basename(ontologyPath, path.extname(ontologyPath));
      serverName =
        baseName
          .split(/[-_]/)
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join('') + 'Server';
    }

    // Interactive mode: prompt for missing information
    if (options.interactive || (!options.githubUsername && !process.env.CI)) {
      console.log();
      console.log(chalk.bold.blue('MCP Tool Factory - Ontology Server Generator'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log();

      if (!options.githubUsername) {
        const wantsRegistry = await confirm('Do you want to publish to the MCP Registry?', true);
        if (wantsRegistry) {
          options.githubUsername = await prompt(
            'GitHub username (for io.github.<username>/<name>)',
            process.env.GITHUB_USER || process.env.USER
          );
          if (!options.githubUsername) {
            console.log(
              chalk.yellow('⚠ No GitHub username provided. Server will use local naming.')
            );
          }
        }
      }

      const customName = await prompt('Server name', serverName);
      if (customName) serverName = customName;

      if (!options.description) {
        options.description = await prompt(
          'Server description (optional)',
          `Ontology-based MCP server from ${path.basename(ontologyPath)}`
        );
      }

      if (options.version === '1.0.0') {
        const customVersion = await prompt('Version', '1.0.0');
        if (customVersion) options.version = customVersion;
      }

      console.log();
    }

    // Build output path
    let outputPath = options.output;
    if (
      outputPath === './servers' ||
      outputPath.endsWith('/servers') ||
      outputPath.endsWith('\\servers')
    ) {
      const serverDirName = serverName.toLowerCase().replace(/[\s-]/g, '_');
      outputPath = path.join(outputPath, serverDirName);
    }

    panel(
      'Ontology to MCP',
      `${chalk.bold.blue('MCP Tool Factory - Ontology')}\n\n` +
        `${chalk.bold('Ontology:')} ${chalk.green(ontologyPath)}\n` +
        `${chalk.bold('Format:')} ${chalk.cyan(format ?? 'auto-detect')}\n` +
        `${chalk.bold('Server Name:')} ${chalk.green(serverName)}\n` +
        `${chalk.bold('Output:')} ${chalk.yellow(outputPath)}`
    );

    const spinner = ora('Parsing ontology...').start();

    try {
      // Ontology generation doesn't need LLM - it's deterministic
      const agent = new ToolFactoryAgent({ requireLlm: false });

      spinner.text = 'Generating MCP server code...';
      const result = await agent.generateFromOntology(content, {
        format,
        serverName,
        description: options.description,
        githubUsername: options.githubUsername,
        version: options.version,
      });

      spinner.text = 'Writing files...';

      // Ensure output directory exists
      fs.mkdirSync(outputPath, { recursive: true });

      // Write files
      const { writeServerToDirectory } = await import('../models/generated-server.js');
      await writeServerToDirectory(result, outputPath);

      spinner.succeed('Done!');

      // Show summary
      console.log();
      panel(
        'Generation Complete',
        `${chalk.bold.green('Successfully generated MCP server!')}\n\n` +
          `${chalk.bold('Tools generated:')} ${result.toolSpecs.length}\n\n` +
          `${chalk.bold('Tools:')}\n` +
          result.toolSpecs
            .slice(0, 10)
            .map((spec) => `  - ${spec.name}`)
            .join('\n') +
          (result.toolSpecs.length > 10 ? `\n  ... and ${result.toolSpecs.length - 10} more` : '')
      );

      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log(`  1. cd ${outputPath}`);
      console.log('  2. npm install');
      console.log('  3. npx tsx src/index.ts');

      // Registry publishing instructions
      if (options.githubUsername) {
        const mcpNameOnt = `io.github.${options.githubUsername}/${serverName.toLowerCase().replace(/\s+/g, '-')}`;
        console.log();
        console.log(chalk.bold.blue('Registry Publishing:'));
        console.log(chalk.dim('  To publish your MCP server to the registry:'));
        console.log('  1. npm publish --access public');
        console.log('  2. brew install modelcontextprotocol/tap/mcp-publisher');
        console.log('  3. mcp-publisher login github');
        console.log('  4. mcp-publisher publish');
        console.log();
        console.log(chalk.dim(`  Registry URL: https://registry.modelcontextprotocol.io/servers/${mcpNameOnt}`));
      }
    } catch (error) {
      spinner.fail('Generation failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

/**
 * test command - run tests for a generated MCP server.
 */
program
  .command('test')
  .description('Run tests for a generated MCP server')
  .argument('<server-path>', 'Directory containing the generated server')
  .action(async (serverPath) => {
    const { spawn } = await import('child_process');

    console.log(chalk.bold(`Running tests for ${serverPath}...`));
    console.log();

    const testsDir = path.join(serverPath, 'tests');
    if (!fs.existsSync(testsDir)) {
      console.error(chalk.red(`Error: Tests directory not found: ${testsDir}`));
      process.exit(1);
    }

    const child = spawn('npx', ['vitest', 'run'], {
      stdio: 'inherit',
      shell: true,
      cwd: serverPath,
    });

    child.on('close', (code) => {
      console.log();
      if (code === 0) {
        console.log(chalk.bold.green('All tests passed!'));
      } else {
        console.log(chalk.bold.red('Some tests failed.'));
      }
      process.exit(code || 0);
    });
  });

/**
 * serve command - start an MCP server for testing.
 */
program
  .command('serve')
  .description('Start an MCP server for testing')
  .argument('<server-path>', 'Directory containing src/index.ts')
  .option('-t, --transport <type>', 'MCP transport to use (stdio, http)', 'stdio')
  .option('-p, --port <port>', 'Port for HTTP transport', '8000')
  .action(async (serverPath, options) => {
    const { spawn } = await import('child_process');

    // Try new location first, fall back to legacy location
    let serverFile = path.join(serverPath, 'src', 'index.ts');
    if (!fs.existsSync(serverFile)) {
      serverFile = path.join(serverPath, 'server.ts');
    }
    if (!fs.existsSync(serverFile)) {
      console.error(chalk.red(`Error: Server file not found. Looked for:`));
      console.error(chalk.red(`  - ${path.join(serverPath, 'src', 'index.ts')}`));
      console.error(chalk.red(`  - ${path.join(serverPath, 'server.ts')}`));
      process.exit(1);
    }

    console.log(chalk.bold('Starting MCP server...'));
    console.log(`Transport: ${options.transport}`);
    if (options.transport === 'http') {
      console.log(`Port: ${options.port}`);
    }
    console.log();

    const env = {
      ...process.env,
      MCP_TRANSPORT: options.transport,
      MCP_PORT: options.port,
    };

    const child = spawn('npx', ['tsx', serverFile], {
      stdio: 'inherit',
      shell: true,
      env,
    });

    process.on('SIGINT', () => {
      console.log();
      console.log(chalk.yellow('Server stopped.'));
      child.kill();
      process.exit(0);
    });

    child.on('close', (code) => {
      process.exit(code || 0);
    });
  });

/**
 * info command - show information about MCP Tool Factory.
 */
program
  .command('info')
  .description('Show information about MCP Tool Factory')
  .action(() => {
    panel(
      'About',
      `${chalk.bold.blue('MCP Tool Factory')} v${getVersion()}\n\n` +
        'Generate universal MCP servers that work with:\n' +
        '  - Claude Code & Claude Desktop\n' +
        '  - OpenAI Agents SDK\n' +
        '  - Google ADK\n' +
        '  - LangChain & CrewAI\n' +
        '  - Any MCP-compatible client\n\n' +
        `${chalk.bold('Commands:')}\n` +
        '  generate      Create MCP server from natural language\n' +
        '  from-openapi  Create MCP server from OpenAPI spec\n' +
        '  from-graphql  Create MCP server from GraphQL schema\n' +
        '  from-database Create MCP server with CRUD tools from database\n' +
        '  from-ontology Create MCP server from ontology (RDF/OWL, JSON-LD, YAML)\n' +
        '  test          Run tests for generated server\n' +
        '  serve         Start MCP server for testing\n\n' +
        `${chalk.bold('Features:')}\n` +
        '  - 10+ LLM providers via Vercel AI SDK\n' +
        '    (Anthropic, OpenAI, Google, Mistral, DeepSeek, Groq, xAI, Azure, Cohere)\n' +
        '  - Web search for API documentation\n' +
        '  - OpenAPI with auth (API Key, Bearer, OAuth2)\n' +
        '  - Database CRUD (SQLite, PostgreSQL)\n' +
        '  - Ontology support (RDF/OWL, JSON-LD, YAML)\n' +
        '  - Health check endpoints\n' +
        '  - GitHub Actions CI/CD\n' +
        '  - Full execution logging\n\n' +
        `${chalk.dim('https://github.com/HeshamFS/mcp-tool-factory-ts')}`
    );
  });

// Parse and run
program.parse();
