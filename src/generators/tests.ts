/**
 * Test code generator for MCP Tool Factory.
 */

import type { ToolSpec } from '../models/tool-spec.js';

/**
 * Configuration for test generation.
 */
export interface TestGeneratorConfig {
  /** Include integration tests */
  includeIntegration?: boolean;
  /** Include edge case tests */
  includeEdgeCases?: boolean;
  /** Include error handling tests */
  includeErrorHandling?: boolean;
}

/**
 * Generated test case.
 */
export interface GeneratedTestCase {
  name: string;
  description: string;
  code: string;
}

/**
 * Generates Vitest test code from tool specifications.
 */
export class TestsGenerator {
  private config: TestGeneratorConfig;

  constructor(config?: TestGeneratorConfig) {
    this.config = {
      includeIntegration: true,
      includeEdgeCases: true,
      includeErrorHandling: true,
      ...config,
    };
  }

  /**
   * Generate complete test file for a server.
   */
  generateTestFile(serverName: string, toolSpecs: ToolSpec[]): string {
    const parts: string[] = [
      '/**',
      ` * Auto-generated tests for ${serverName} MCP server`,
      ' * Uses InMemoryTransport for fast, reliable testing.',
      ' */',
      '',
      "import { describe, it, expect, beforeAll, afterAll } from 'vitest';",
      "import { Client } from '@modelcontextprotocol/sdk/client/index.js';",
      "import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';",
      "import { createServer } from '../src/index.js';",
      '',
      `describe('${serverName} MCP Server', () => {`,
      '  let client: Client;',
      '  let cleanup: () => Promise<void>;',
      '',
      '  beforeAll(async () => {',
      '    const server = createServer();',
      '    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();',
      '',
      '    client = new Client({',
      "      name: 'test-client',",
      "      version: '1.0.0',",
      '    });',
      '',
      '    await server.connect(serverTransport);',
      '    await client.connect(clientTransport);',
      '',
      '    cleanup = async () => {',
      '      await client.close();',
      '      await server.close();',
      '    };',
      '  });',
      '',
      '  afterAll(async () => {',
      '    await cleanup?.();',
      '  });',
      '',
    ];

    // Test that all tools are registered
    parts.push(
      "  describe('Tool Registration', () => {",
      "    it('should have all expected tools', async () => {",
      '      const result = await client.listTools();',
      '      const toolNames = result.tools.map(t => t.name);',
      ''
    );

    for (const spec of toolSpecs) {
      parts.push(`      expect(toolNames).toContain('${spec.name}');`);
    }

    parts.push(
      '    });',
      '  });',
      ''
    );

    // Generate tests for each tool
    for (const spec of toolSpecs) {
      parts.push(...this.generateToolTests(spec));
    }

    parts.push('});', '');

    return parts.join('\n');
  }

  /**
   * Generate tests for a single tool.
   */
  private generateToolTests(spec: ToolSpec): string[] {
    const parts: string[] = [
      `  describe('${spec.name}', () => {`,
      '',
    ];

    // Happy path test
    parts.push(...this.generateHappyPathTest(spec));

    // Edge case tests
    if (this.config.includeEdgeCases) {
      parts.push(...this.generateEdgeCaseTests(spec));
    }

    // Error handling tests
    if (this.config.includeErrorHandling) {
      parts.push(...this.generateErrorHandlingTests(spec));
    }

    parts.push('  });', '');

    return parts;
  }

  /**
   * Generate happy path test for a tool.
   */
  private generateHappyPathTest(spec: ToolSpec): string[] {
    const parts: string[] = [
      `    it('should succeed with valid input', async () => {`,
    ];

    // Build example params
    const props = spec.inputSchema.properties ?? {};
    const required = spec.inputSchema.required ?? [];
    const exampleParams: string[] = [];

    for (const [name, schema] of Object.entries(props)) {
      if (required.includes(name)) {
        exampleParams.push(`        ${name}: ${this.getExampleValue(schema.type)},`);
      }
    }

    parts.push(`      const result = await client.callTool('${spec.name}', {`);
    parts.push(...exampleParams);
    parts.push('      });', '');
    parts.push("      expect(result).toBeDefined();");
    parts.push("      expect(result.content).toBeDefined();");
    parts.push('    });', '');

    return parts;
  }

  /**
   * Generate edge case tests for a tool.
   */
  private generateEdgeCaseTests(spec: ToolSpec): string[] {
    const parts: string[] = [];
    const props = spec.inputSchema.properties ?? {};

    // Test with empty strings
    const stringProps = Object.entries(props).filter(([_, s]) => s.type === 'string');
    if (stringProps.length > 0) {
      parts.push(
        `    it('should handle empty strings gracefully', async () => {`,
        `      const result = await client.callTool('${spec.name}', {`
      );

      for (const [name] of stringProps) {
        parts.push(`        ${name}: '',`);
      }

      parts.push(
        '      });',
        '',
        "      expect(result).toBeDefined();",
        '    });',
        ''
      );
    }

    // Test with zero values
    const numberProps = Object.entries(props).filter(
      ([_, s]) => s.type === 'integer' || s.type === 'number'
    );
    if (numberProps.length > 0) {
      parts.push(
        `    it('should handle zero values', async () => {`,
        `      const result = await client.callTool('${spec.name}', {`
      );

      for (const [name] of numberProps) {
        parts.push(`        ${name}: 0,`);
      }

      parts.push(
        '      });',
        '',
        "      expect(result).toBeDefined();",
        '    });',
        ''
      );
    }

    return parts;
  }

  /**
   * Generate error handling tests for a tool.
   */
  private generateErrorHandlingTests(spec: ToolSpec): string[] {
    const parts: string[] = [];

    // Test with missing required params
    const required = spec.inputSchema.required ?? [];
    if (required.length > 0) {
      parts.push(
        `    it('should handle missing required params', async () => {`,
        `      const result = await client.callTool('${spec.name}', {});`,
        '',
        "      expect(result).toBeDefined();",
        '      // Should not crash, may return error',
        '    });',
        ''
      );
    }

    // Test with invalid types
    parts.push(
      `    it('should handle invalid input types', async () => {`,
      `      const result = await client.callTool('${spec.name}', {`
    );

    const props = spec.inputSchema.properties ?? {};
    for (const [name, schema] of Object.entries(props)) {
      if (required.includes(name)) {
        // Pass wrong type
        if (schema.type === 'string') {
          parts.push(`        ${name}: 123,`);
        } else if (schema.type === 'integer' || schema.type === 'number') {
          parts.push(`        ${name}: 'invalid',`);
        } else if (schema.type === 'boolean') {
          parts.push(`        ${name}: 'not-bool',`);
        } else {
          parts.push(`        ${name}: null,`);
        }
      }
    }

    parts.push(
      '      } as unknown as Record<string, unknown>);',
      '',
      "      expect(result).toBeDefined();",
      '    });',
      ''
    );

    return parts;
  }

  /**
   * Get example value for a JSON Schema type.
   */
  private getExampleValue(type?: string): string {
    switch (type) {
      case 'string':
        return "'example'";
      case 'integer':
        return '42';
      case 'number':
        return '3.14';
      case 'boolean':
        return 'true';
      case 'array':
        return '[]';
      case 'object':
        return '{}';
      default:
        return "'value'";
    }
  }
}
