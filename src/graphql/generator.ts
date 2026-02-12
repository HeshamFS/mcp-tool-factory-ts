/**
 * GraphQL Server Generator for MCP Tool Factory.
 *
 * Generates MCP servers from GraphQL SDL schemas by mapping:
 * - Query fields to read-only MCP tools
 * - Mutation fields to write MCP tools
 * - GraphQL scalar types to Zod validation schemas
 *
 * @module graphql/generator
 */

import type { ToolSpec } from '../models/tool-spec.js';
import { createToolSpec } from '../models/tool-spec.js';

/**
 * Parsed GraphQL field argument.
 */
interface GraphQLArgument {
  name: string;
  typeName: string;
  isNonNull: boolean;
  isList: boolean;
}

/**
 * Parsed GraphQL field.
 */
interface GraphQLField {
  name: string;
  description: string;
  args: GraphQLArgument[];
  returnTypeName: string;
  isQuery: boolean;
  isMutation: boolean;
}

/**
 * Convert a GraphQL field name to a snake_case tool name.
 */
function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Map a GraphQL scalar type name to a Zod schema string.
 */
function graphqlTypeToZod(typeName: string, isNonNull: boolean, isList: boolean): string {
  let base: string;
  switch (typeName) {
    case 'String':
    case 'ID':
      base = 'z.string()';
      break;
    case 'Int':
      base = 'z.number()';
      break;
    case 'Float':
      base = 'z.number()';
      break;
    case 'Boolean':
      base = 'z.boolean()';
      break;
    default:
      // Custom types → accept as object
      base = 'z.record(z.unknown())';
      break;
  }

  if (isList) {
    base = `z.array(${base})`;
  }

  if (!isNonNull) {
    base += '.optional()';
  }

  return base;
}

/**
 * Map a GraphQL scalar type name to JSON Schema type.
 */
function graphqlTypeToJsonSchema(typeName: string): string {
  switch (typeName) {
    case 'String':
    case 'ID':
      return 'string';
    case 'Int':
      return 'integer';
    case 'Float':
      return 'number';
    case 'Boolean':
      return 'boolean';
    default:
      return 'object';
  }
}

/**
 * Unwrap a GraphQL type node to get the base type name, nullability, and list status.
 */
function unwrapType(typeNode: unknown): { typeName: string; isNonNull: boolean; isList: boolean } {
  const node = typeNode as Record<string, unknown>;
  const kind = node.kind as string;

  if (kind === 'NonNullType') {
    const inner = unwrapType(node.type);
    return { ...inner, isNonNull: true };
  }

  if (kind === 'ListType') {
    const inner = unwrapType(node.type);
    return { ...inner, isList: true };
  }

  // NamedType
  const nameNode = node.name as Record<string, unknown>;
  return {
    typeName: nameNode.value as string,
    isNonNull: false,
    isList: false,
  };
}

/**
 * Generates MCP server code from a GraphQL SDL schema.
 *
 * Parses the SDL using the `graphql` package, extracts Query and Mutation
 * type fields, and produces a standalone TypeScript MCP server where each
 * GraphQL field becomes a tool. Query fields become read tools and mutation
 * fields become write tools.
 *
 * @example
 * ```typescript
 * const gen = new GraphQLServerGenerator(sdlString, 'https://api.example.com/graphql');
 * const code = gen.generateServerCode('my-api');
 * const specs = gen.getToolSpecs();
 * ```
 */
export class GraphQLServerGenerator {
  private schemaString: string;
  private endpoint: string;
  private fields: GraphQLField[] = [];

  /**
   * @param schemaString - GraphQL SDL schema string to parse
   * @param endpoint - GraphQL endpoint URL (defaults to `http://localhost:4000/graphql`)
   */
  constructor(schemaString: string, endpoint?: string) {
    this.schemaString = schemaString;
    this.endpoint = endpoint ?? 'http://localhost:4000/graphql';
    this.parseSchema();
  }

  /**
   * Parse the GraphQL SDL schema to extract query and mutation fields.
   */
  private parseSchema(): void {
    // Use the graphql package's parse function via dynamic require detection
    // We parse the SDL manually to extract type definitions
    let document: Record<string, unknown>;
    try {
      // Dynamic import is async, so we use a synchronous parse approach
      // The graphql package exposes a parse function we can use
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const graphql = require('graphql');
      document = graphql.parse(this.schemaString) as Record<string, unknown>;
    } catch {
      // Fallback: try to dynamically load
      throw new Error(
        'The "graphql" package is required for GraphQL schema parsing. Install with: npm install graphql'
      );
    }

    const definitions = document.definitions as Array<Record<string, unknown>>;

    for (const def of definitions) {
      const kind = def.kind as string;
      if (kind !== 'ObjectTypeDefinition' && kind !== 'ObjectTypeExtension') continue;

      const nameNode = def.name as Record<string, unknown>;
      const typeName = nameNode.value as string;

      const isQuery = typeName === 'Query';
      const isMutation = typeName === 'Mutation';
      if (!isQuery && !isMutation) continue;

      const fieldDefs = (def.fields as Array<Record<string, unknown>>) ?? [];

      for (const fieldDef of fieldDefs) {
        const fieldNameNode = fieldDef.name as Record<string, unknown>;
        const fieldName = fieldNameNode.value as string;

        // Get description
        const descNode = fieldDef.description as Record<string, unknown> | undefined;
        const description = (descNode?.value as string) ?? `${isQuery ? 'Query' : 'Mutation'}: ${fieldName}`;

        // Parse arguments
        const argDefs = (fieldDef.arguments as Array<Record<string, unknown>>) ?? [];
        const args: GraphQLArgument[] = argDefs.map((argDef) => {
          const argNameNode = argDef.name as Record<string, unknown>;
          const { typeName: argTypeName, isNonNull, isList } = unwrapType(argDef.type);
          return {
            name: argNameNode.value as string,
            typeName: argTypeName,
            isNonNull,
            isList,
          };
        });

        // Parse return type
        const { typeName: returnTypeName } = unwrapType(fieldDef.type);

        this.fields.push({
          name: fieldName,
          description,
          args,
          returnTypeName,
          isQuery,
          isMutation,
        });
      }
    }
  }

  /**
   * Generate the complete MCP server TypeScript source code.
   *
   * @param serverName - Name for the generated MCP server
   * @returns TypeScript source code string ready to be written to a file
   */
  generateServerCode(serverName: string): string {
    const parts: string[] = [
      '/**',
      ` * Auto-generated MCP server: ${serverName}`,
      ' * Generated from GraphQL schema',
      ' */',
      '',
      "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';",
      "import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';",
      "import { z } from 'zod';",
      '',
      `const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT ?? '${this.endpoint}';`,
      "const GRAPHQL_AUTH_TOKEN = process.env.GRAPHQL_AUTH_TOKEN ?? '';",
      '',
      'const server = new McpServer({',
      `  name: '${serverName}',`,
      "  version: '1.0.0',",
      '});',
      '',
      '// ============== GRAPHQL HELPER ==============',
      '',
      'async function graphqlRequest(query: string, variables?: Record<string, unknown>): Promise<unknown> {',
      '  const headers: Record<string, string> = {',
      "    'Content-Type': 'application/json',",
      '  };',
      '  if (GRAPHQL_AUTH_TOKEN) {',
      "    headers['Authorization'] = `Bearer ${GRAPHQL_AUTH_TOKEN}`;",
      '  }',
      '',
      '  const response = await fetch(GRAPHQL_ENDPOINT, {',
      "    method: 'POST',",
      '    headers,',
      '    body: JSON.stringify({ query, variables }),',
      '  });',
      '',
      '  const json = await response.json() as Record<string, unknown>;',
      '  if (json.errors) {',
      '    throw new Error(JSON.stringify(json.errors));',
      '  }',
      '  return json.data;',
      '}',
      '',
      '// ============== TOOLS ==============',
      '',
    ];

    for (const field of this.fields) {
      parts.push(...this.generateToolCode(field));
    }

    parts.push('// ============== MAIN ==============');
    parts.push('');
    parts.push('async function main(): Promise<void> {');
    parts.push('  const transport = new StdioServerTransport();');
    parts.push('  await server.connect(transport);');
    parts.push('}');
    parts.push('');
    parts.push('main().catch(console.error);');
    parts.push('');

    return parts.join('\n');
  }

  /**
   * Generate code for a single tool from a GraphQL field.
   */
  private generateToolCode(field: GraphQLField): string[] {
    const parts: string[] = [];
    const toolName = toSnakeCase(field.name);
    const operationType = field.isQuery ? 'query' : 'mutation';

    parts.push('server.tool(');
    parts.push(`  '${toolName}',`);
    parts.push(`  '${field.description.replace(/'/g, "\\'")}',`);
    parts.push('  {');

    // Add parameters from arguments
    for (const arg of field.args) {
      const zodType = graphqlTypeToZod(arg.typeName, arg.isNonNull, arg.isList);
      parts.push(`    ${arg.name}: ${zodType}.describe('${arg.name} parameter'),`);
    }

    parts.push('  },');
    parts.push('  async (params) => {');
    parts.push('    try {');

    // Build the GraphQL query/mutation string
    const argDefs = field.args.length > 0
      ? `(${field.args.map((a) => `$${a.name}: ${this.buildGraphQLTypeString(a)}`).join(', ')})`
      : '';
    const argUsage = field.args.length > 0
      ? `(${field.args.map((a) => `${a.name}: $${a.name}`).join(', ')})`
      : '';

    const gqlQuery = `${operationType} { ${field.name}${argUsage} }`;
    const gqlQueryWithVars = field.args.length > 0
      ? `${operationType}${argDefs} { ${field.name}${argUsage} }`
      : gqlQuery;

    parts.push(`      const query = \`${gqlQueryWithVars}\`;`);

    if (field.args.length > 0) {
      parts.push('      const variables: Record<string, unknown> = {};');
      for (const arg of field.args) {
        parts.push(`      if (params.${arg.name} !== undefined) variables['${arg.name}'] = params.${arg.name};`);
      }
      parts.push('      const data = await graphqlRequest(query, variables);');
    } else {
      parts.push('      const data = await graphqlRequest(query);');
    }

    parts.push('      return {');
    parts.push('        content: [{ type: "text", text: JSON.stringify(data) }]');
    parts.push('      };');
    parts.push('    } catch (e) {');
    parts.push('      const error = e instanceof Error ? e.message : String(e);');
    parts.push('      return {');
    parts.push('        content: [{ type: "text", text: JSON.stringify({ error }) }]');
    parts.push('      };');
    parts.push('    }');
    parts.push('  }');
    parts.push(');');
    parts.push('');

    return parts;
  }

  /**
   * Build a GraphQL type string for query variable definitions.
   */
  private buildGraphQLTypeString(arg: GraphQLArgument): string {
    let typeStr = arg.typeName;
    if (arg.isList) {
      typeStr = `[${typeStr}]`;
    }
    if (arg.isNonNull) {
      typeStr += '!';
    }
    return typeStr;
  }

  /**
   * Get tool specifications for documentation and template generation.
   *
   * @returns Array of {@link ToolSpec} objects describing each generated tool's name, description, and input schema
   */
  getToolSpecs(): ToolSpec[] {
    return this.fields.map((field) => {
      const properties: Record<string, { type: string; description: string }> = {};
      const required: string[] = [];

      for (const arg of field.args) {
        properties[arg.name] = {
          type: graphqlTypeToJsonSchema(arg.typeName),
          description: `${arg.name} parameter`,
        };
        if (arg.isNonNull) {
          required.push(arg.name);
        }
      }

      return createToolSpec({
        name: toSnakeCase(field.name),
        description: field.description,
        inputSchema: {
          type: 'object',
          properties,
          required,
        },
        dependencies: [],
      });
    });
  }

  /**
   * Get environment variable names for authentication.
   */
  getAuthEnvVars(): string[] {
    return ['GRAPHQL_ENDPOINT', 'GRAPHQL_AUTH_TOKEN'];
  }
}
