/**
 * Documentation generator for MCP Tool Factory.
 */

import type { ToolSpec } from '../models/tool-spec.js';

/**
 * Generates documentation for MCP servers.
 */
export class DocsGenerator {
  /**
   * Generate a tagline based on the server's tools.
   */
  private generateOverviewTagline(
    serverName: string,
    toolSpecs: ToolSpec[],
    description?: string | null
  ): string {
    if (description && description.length > 20) {
      const firstSentence = description.split('.')[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        return firstSentence;
      }
    }

    const allText = toolSpecs.map((s) => s.description.toLowerCase()).join(' ');

    // Detect common domains
    const domains: [string[], string][] = [
      [
        ['weather', 'temperature', 'forecast', 'climate'],
        'Weather and climate data tools for AI agents',
      ],
      [
        ['database', 'sql', 'query', 'crud', 'table'],
        'Database operations and CRUD tools for AI agents',
      ],
      [
        ['github', 'repository', 'commit', 'pull request', 'issue'],
        'GitHub integration tools for AI agents',
      ],
      [
        ['iot', 'device', 'sensor', 'thing', 'ditto', 'twin'],
        'IoT device management tools for AI agents',
      ],
      [['api', 'rest', 'http', 'endpoint'], 'REST API integration tools for AI agents'],
      [
        ['file', 'document', 'read', 'write', 'storage'],
        'File and document management tools for AI agents',
      ],
      [
        ['email', 'message', 'notification', 'send'],
        'Communication and messaging tools for AI agents',
      ],
      [['payment', 'stripe', 'transaction', 'billing'], 'Payment processing tools for AI agents'],
      [['search', 'find', 'query', 'lookup'], 'Search and discovery tools for AI agents'],
      [
        ['user', 'auth', 'login', 'account'],
        'User management and authentication tools for AI agents',
      ],
    ];

    for (const [keywords, tagline] of domains) {
      if (keywords.some((word) => allText.includes(word))) {
        return tagline;
      }
    }

    return `MCP tools for ${serverName} operations`;
  }

  /**
   * Generate a rich overview description.
   */
  private generateOverviewDescription(
    serverName: string,
    toolSpecs: ToolSpec[],
    description?: string | null
  ): string {
    const toolCount = toolSpecs.length;
    const toolNames = toolSpecs.slice(0, 5).map((s) => `\`${s.name}\``);
    let toolsList = toolNames.join(', ');
    if (toolSpecs.length > 5) {
      toolsList += `, and ${toolSpecs.length - 5} more`;
    }

    const baseDesc =
      description ?? `An MCP server providing ${toolCount} tools for various operations.`;

    return (
      'An MCP (Model Context Protocol) server that enables AI agents to ' +
      'perform specialized operations through a standardized interface.\n\n' +
      `**${serverName}** provides ${toolCount} tools including ${toolsList}.\n\n` +
      baseDesc
    );
  }

  /**
   * Generate a summary table of all tools.
   */
  private generateToolsSummaryTable(toolSpecs: ToolSpec[]): string[] {
    const parts = ['## Tools Overview', '', '| Tool | Description |', '|------|-------------|'];

    for (const spec of toolSpecs) {
      let desc = spec.description.split('.')[0]?.trim() ?? '';
      if (desc.length > 60) {
        desc = desc.slice(0, 57) + '...';
      }
      parts.push(`| \`${spec.name}\` | ${desc} |`);
    }

    parts.push('');
    return parts;
  }

  /**
   * Generate a Mermaid architecture diagram.
   */
  private generateArchitectureDiagram(serverName: string, toolSpecs: ToolSpec[]): string[] {
    const toolNames = toolSpecs.slice(0, 8).map((s) => s.name);

    const parts = [
      '## Architecture',
      '',
      '```mermaid',
      'flowchart LR',
      '    subgraph Agents["AI Agents"]',
      '        A[Claude / GPT / LangChain]',
      '    end',
      '',
      `    subgraph Server["${serverName}"]`,
    ];

    toolNames.forEach((name, i) => {
      parts.push(`        T${i}[${name}]`);
    });

    parts.push(
      '    end',
      '',
      '    subgraph Output["Results"]',
      '        R[Structured Data / Actions]',
      '    end',
      '',
      '    Agents --> Server',
      '    Server --> Output',
      '```',
      ''
    );

    return parts;
  }

  /**
   * Generate a Mermaid flow diagram.
   */
  private generateFlowDiagram(serverName: string): string[] {
    return [
      '## How It Works',
      '',
      '```mermaid',
      'sequenceDiagram',
      '    participant Agent as AI Agent',
      `    participant Server as ${serverName}`,
      '    participant Target as External Service/Data',
      '',
      '    Agent->>Server: Tool call with parameters',
      '    Server->>Server: Validate inputs',
      '    Server->>Target: Execute operation',
      '    Target-->>Server: Return result',
      '    Server-->>Agent: Structured response',
      '```',
      '',
    ];
  }

  /**
   * Generate README.md for the server.
   */
  generateReadme(
    serverName: string,
    toolSpecs: ToolSpec[],
    options?: {
      authEnvVars?: string[];
      description?: string | null;
    }
  ): string {
    const { authEnvVars = [], description } = options ?? {};
    const serverSlug = serverName.toLowerCase().replace(/\s+/g, '-');

    const tagline = this.generateOverviewTagline(serverName, toolSpecs, description);
    const overview = this.generateOverviewDescription(serverName, toolSpecs, description);

    const parts = [
      `# ${serverName}`,
      '',
      `**${tagline}**`,
      '',
      '---',
      '',
      '## Overview',
      '',
      overview,
      '',
    ];

    // Add diagrams
    parts.push(...this.generateArchitectureDiagram(serverName, toolSpecs));
    parts.push(...this.generateFlowDiagram(serverName));
    parts.push(...this.generateToolsSummaryTable(toolSpecs));

    // Quick Start
    parts.push(
      '---',
      '',
      '## Quick Start',
      '',
      '```bash',
      '# Install dependencies',
      'npm install',
      '',
      '# Run the server',
      'npm run dev',
      '```',
      ''
    );

    // Environment variables
    if (authEnvVars.length > 0) {
      parts.push(
        '## Environment Variables',
        '',
        'Create a `.env` file or set these environment variables:',
        '',
        '```bash'
      );
      for (const v of authEnvVars) {
        parts.push(`export ${v}=your-api-key-here`);
      }
      parts.push('```', '');
    }

    // Installation
    parts.push(
      '## Installation',
      '',
      '```bash',
      'npm install',
      '```',
      '',
      '## Usage',
      '',
      '### With Claude Code / Claude Desktop',
      '',
      'Add to your `.claude/mcp.json`:',
      '',
      '```json',
      '{',
      '  "mcpServers": {',
      `    "${serverSlug}": {`,
      '      "command": "npx",',
      '      "args": ["tsx", "./src/index.ts"]'
    );

    if (authEnvVars.length > 0) {
      parts.push('      "env": {');
      authEnvVars.forEach((v, i) => {
        const comma = i < authEnvVars.length - 1 ? ',' : '';
        parts.push(`        "${v}": "\${env:${v}}"${comma}`);
      });
      parts.push('      }');
    }

    parts.push(
      '    }',
      '  }',
      '}',
      '```',
      '',
      '### With Docker',
      '',
      '```bash',
      '# Build',
      `docker build -t ${serverSlug} .`,
      '',
      '# Run'
    );

    if (authEnvVars.length > 0) {
      const envFlags = authEnvVars.map((v) => `-e ${v}`).join(' ');
      parts.push(`docker run ${envFlags} ${serverSlug}`);
    } else {
      parts.push(`docker run ${serverSlug}`);
    }

    parts.push(
      '```',
      '',
      '### Streamable HTTP Transport',
      '',
      'For web integrations, you can use Streamable HTTP transport:',
      '',
      '```bash',
      '# Start with HTTP transport',
      'MCP_TRANSPORT=http MCP_PORT=8000 npm run dev',
      '```',
      '',
      'Then connect via:',
      '- **MCP endpoint:** `POST http://localhost:8000/mcp`',
      '- **Health check:** `GET http://localhost:8000/health`',
      '',
      '---',
      '',
      '## Tool Reference',
      ''
    );

    // Tool documentation
    for (const spec of toolSpecs) {
      parts.push(`### \`${spec.name}\``, '', spec.description, '');

      const props = spec.inputSchema.properties ?? {};
      const required = spec.inputSchema.required ?? [];

      if (Object.keys(props).length > 0) {
        parts.push(
          '**Parameters:**',
          '',
          '| Name | Type | Required | Description |',
          '|------|------|----------|-------------|'
        );

        for (const [name, schema] of Object.entries(props)) {
          const type = schema.type ?? 'any';
          const desc = schema.description ?? '';
          const req = required.includes(name) ? 'Yes' : 'No';
          parts.push(`| \`${name}\` | ${type} | ${req} | ${desc} |`);
        }
        parts.push('');
      }

      parts.push('---', '');
    }

    // Testing
    parts.push(
      '## Testing',
      '',
      '```bash',
      'npm test',
      '```',
      '',
      '---',
      ''
    );

    // MCP Registry Publishing
    parts.push(...this.generateRegistryPublishingSection(serverSlug));

    parts.push('---', '', '## License', '', 'MIT', '');

    return parts.join('\n');
  }

  /**
   * Generate the MCP Registry publishing section for README.
   */
  private generateRegistryPublishingSection(_serverSlug: string): string[] {
    return [
      '## Publishing to MCP Registry',
      '',
      'This server is ready for publishing to the [MCP Registry](https://registry.modelcontextprotocol.io).',
      '',
      '### Prerequisites',
      '',
      '1. An npm account (for package publishing)',
      '2. A GitHub account (for registry authentication)',
      '3. The `mcp-publisher` CLI tool',
      '',
      '### Step 1: Publish to npm',
      '',
      '```bash',
      '# Login to npm (if not already logged in)',
      'npm login',
      '',
      '# Publish the package',
      'npm publish --access public',
      '```',
      '',
      '### Step 2: Install mcp-publisher',
      '',
      '```bash',
      '# macOS',
      'brew install modelcontextprotocol/tap/mcp-publisher',
      '',
      '# Or download from GitHub releases',
      '# https://github.com/modelcontextprotocol/mcp-publisher/releases',
      '```',
      '',
      '### Step 3: Authenticate with GitHub',
      '',
      '```bash',
      'mcp-publisher login github',
      '```',
      '',
      '### Step 4: Publish to MCP Registry',
      '',
      '```bash',
      'mcp-publisher publish',
      '```',
      '',
      'The publisher will validate your `server.json` and submit your server to the registry.',
      '',
      '### Troubleshooting',
      '',
      '| Issue | Solution |',
      '|-------|----------|',
      '| `server.json` validation fails | Ensure all required fields are present and correctly formatted |',
      '| npm publish fails | Check that package name is unique and you\'re logged in |',
      '| Registry submission rejected | Verify your `mcpName` follows the `io.github.<user>/<name>` format |',
      '| Authentication error | Re-run `mcp-publisher login github` |',
      '',
      '### Registry Files',
      '',
      `- \`server.json\` - MCP Registry manifest (required)`,
      `- \`package.json\` - Contains \`mcpName\` field for registry lookup`,
      '',
    ];
  }

  /**
   * Generate Claude Code skill file.
   */
  generateSkill(serverName: string, toolSpecs: ToolSpec[]): string {
    const tagline = this.generateOverviewTagline(serverName, toolSpecs, null);

    const parts = [
      `# ${serverName}`,
      '',
      tagline,
      '',
      '## Overview',
      '',
      `This MCP server provides ${toolSpecs.length} tools for AI agents.`,
      '',
      '## Available Tools',
      '',
    ];

    for (const spec of toolSpecs) {
      parts.push(`### ${spec.name}`, '', spec.description, '');

      const props = spec.inputSchema.properties ?? {};
      const required = spec.inputSchema.required ?? [];

      if (Object.keys(props).length > 0) {
        parts.push('**Parameters:**');
        for (const [name, schema] of Object.entries(props)) {
          const desc = schema.description ?? 'No description';
          const reqStr = required.includes(name) ? ' (required)' : ' (optional)';
          parts.push(`- \`${name}\`${reqStr}: ${desc}`);
        }
        parts.push('');
      }

      parts.push(
        '**Example:**',
        '```',
        `Use the ${spec.name} tool to ${spec.description.toLowerCase()}`,
        '```',
        ''
      );
    }

    // Setup instructions
    parts.push(
      '## Setup',
      '',
      'Add to your Claude Code MCP configuration:',
      '',
      '```json',
      '{',
      '  "mcpServers": {',
      `    "${serverName.toLowerCase().replace(/\s+/g, '-')}": {`,
      '      "command": "npx",',
      '      "args": ["tsx", "path/to/src/index.ts"]',
      '    }',
      '  }',
      '}',
      '```',
      ''
    );

    return parts.join('\n');
  }

  /**
   * Generate CHANGELOG.md following Keep a Changelog format.
   */
  generateChangelog(serverName: string, toolSpecs: ToolSpec[], version: string = '1.0.0'): string {
    const date = new Date().toISOString().split('T')[0];
    const toolNames = toolSpecs.map((s) => `\`${s.name}\``).join(', ');

    const parts = [
      '# Changelog',
      '',
      'All notable changes to this project will be documented in this file.',
      '',
      'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),',
      'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
      '',
      `## [${version}] - ${date}`,
      '',
      '### Added',
      '',
      `- Initial release of ${serverName}`,
      `- MCP tools: ${toolNames}`,
      '- MCP Protocol support via stdio transport',
      '- Streamable HTTP transport support (set `MCP_TRANSPORT=http`)',
      '- Health check endpoint (`health_check` tool)',
      '- Docker support with multi-stage build',
      '- GitHub Actions CI/CD workflow',
      '- TypeDoc API documentation',
      '- Comprehensive test suite',
      '',
      '### Security',
      '',
      '- Input validation using Zod schemas',
      '- Environment-based authentication configuration',
      '',
    ];

    return parts.join('\n');
  }

  /**
   * Generate tools.json - machine-readable API specification.
   */
  generateToolsSpec(serverName: string, toolSpecs: ToolSpec[]): string {
    const spec = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: `${serverName} Tools`,
      description: `MCP tools provided by ${serverName}`,
      version: '1.0.0',
      tools: toolSpecs.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: tool.inputSchema.properties ?? {},
          required: tool.inputSchema.required ?? [],
        },
        dependencies: tool.dependencies,
        examples: [
          {
            description: `Example usage of ${tool.name}`,
            input: this.generateExampleInput(tool),
          },
        ],
      })),
    };

    return JSON.stringify(spec, null, 2);
  }

  /**
   * Generate example input for a tool based on its schema.
   */
  private generateExampleInput(tool: ToolSpec): Record<string, unknown> {
    const example: Record<string, unknown> = {};
    const props = tool.inputSchema.properties ?? {};

    for (const [name, schema] of Object.entries(props)) {
      switch (schema.type) {
        case 'string':
          example[name] = schema.description?.includes('url')
            ? 'https://example.com'
            : schema.description?.includes('email')
              ? 'user@example.com'
              : `example_${name}`;
          break;
        case 'number':
        case 'integer':
          example[name] = 42;
          break;
        case 'boolean':
          example[name] = true;
          break;
        case 'array':
          example[name] = [];
          break;
        case 'object':
          example[name] = {};
          break;
        default:
          example[name] = `example_${name}`;
      }
    }

    return example;
  }

  /**
   * Generate docs/index.md - API documentation entry point.
   */
  generateApiDocsIndex(serverName: string, toolSpecs: ToolSpec[]): string {
    const parts = [
      `# ${serverName} API Documentation`,
      '',
      '## Overview',
      '',
      `This documentation covers the ${toolSpecs.length} MCP tools provided by ${serverName}.`,
      '',
      '## Resources',
      '',
      '- **[TypeDoc API Reference](./api/index.html)** - Auto-generated TypeScript documentation',
      '- **[tools.json](./tools.json)** - Machine-readable tool specifications (JSON Schema)',
      '- **[README](../README.md)** - Getting started guide',
      '',
      '## Tools Summary',
      '',
      '| Tool | Description |',
      '|------|-------------|',
    ];

    for (const tool of toolSpecs) {
      const shortDesc = tool.description.split('.')[0] || tool.description;
      parts.push(`| \`${tool.name}\` | ${shortDesc} |`);
    }

    parts.push('', '## Tool Details', '');

    for (const tool of toolSpecs) {
      parts.push(
        `### ${tool.name}`,
        '',
        tool.description,
        '',
        '**Input Schema:**',
        '',
        '```json',
        JSON.stringify(tool.inputSchema, null, 2),
        '```',
        ''
      );
    }

    parts.push(
      '## Generating Documentation',
      '',
      'To regenerate the TypeDoc API documentation:',
      '',
      '```bash',
      'npm run docs',
      '```',
      '',
      'This will update the `docs/api/` directory with the latest TypeScript documentation.',
      ''
    );

    return parts.join('\n');
  }
}
