/**
 * Ontology Server Generator for MCP Tool Factory.
 *
 * Generates MCP servers with CRUD tools and relationship tools
 * from ontology definitions (RDF/OWL, JSON-LD, custom YAML).
 */

import type { ToolSpec } from '../models/tool-spec.js';
import { createToolSpec } from '../models/tool-spec.js';
import type { OntologyDefinition, OntologyClass, OntologyProperty } from './types.js';

/**
 * Make a safe function/variable name from a label or URI fragment.
 */
function safeName(name: string): string {
  return name
    .replace(/^#/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase();
}

/**
 * Map an ontology data property range to a Zod type expression.
 */
function rangeToZod(range: string): string {
  switch (range) {
    case 'integer':
      return 'z.number().int()';
    case 'number':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    default:
      return 'z.string()';
  }
}

/**
 * Map an ontology data property range to a JSON Schema type.
 */
function rangeToJsonSchema(range: string): string {
  switch (range) {
    case 'integer':
      return 'integer';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'string';
  }
}

/**
 * Generates MCP server code from an {@link OntologyDefinition}.
 *
 * Mapping strategy:
 * - Each ontology class becomes a set of CRUD tools (create, get, update, delete, list)
 * - Object properties become relationship-linking tools (`link_<source>_<relation>`)
 * - Data properties become Zod-validated input parameters on create/update tools
 * - Pre-defined individuals are seeded into in-memory stores
 * - Each class is also exposed as a resource (`ontology://<className>`)
 *
 * @example
 * ```typescript
 * const parser = new OntologyParser();
 * const definition = await parser.parse(turtleContent);
 * const gen = new OntologyServerGenerator(definition);
 * const code = gen.generateServerCode('my-ontology-server');
 * ```
 */
export class OntologyServerGenerator {
  private definition: OntologyDefinition;

  /**
   * @param definition - Parsed ontology definition to generate a server from
   */
  constructor(definition: OntologyDefinition) {
    this.definition = definition;
  }

  /**
   * Generate the complete MCP server TypeScript source code.
   *
   * @param serverName - Name for the generated MCP server
   * @returns TypeScript source code string with CRUD tools, relationship tools, and in-memory stores
   */
  generateServerCode(serverName: string): string {
    const imports = this.generateImports();
    const storeSetup = this.generateStoreSetup();
    const healthCheck = this.generateHealthCheck(serverName);

    const tools: string[] = [];
    for (const cls of this.definition.classes) {
      tools.push(...this.generateClassTools(cls));
    }

    // Generate relationship tools for object properties
    const relTools: string[] = [];
    for (const cls of this.definition.classes) {
      for (const prop of cls.objectProperties) {
        relTools.push(this.generateRelationshipTool(cls, prop));
      }
    }

    return `/**
 * Auto-generated MCP server: ${serverName}
 * Generated from ontology: ${this.definition.name}
 */

${imports}

const server = new McpServer({
  name: '${serverName}',
  version: '1.0.0',
});

${storeSetup}

${healthCheck}

// ============== ONTOLOGY CRUD TOOLS ==============

${tools.join('\n')}

// ============== RELATIONSHIP TOOLS ==============

${relTools.join('\n')}

// ============== MAIN ==============

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
`;
  }

  /**
   * Generate import statements.
   */
  private generateImports(): string {
    return [
      "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';",
      "import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';",
      "import { z } from 'zod';",
      "import { randomUUID } from 'crypto';",
    ].join('\n');
  }

  /**
   * Generate the in-memory store setup with pre-populated individuals.
   */
  private generateStoreSetup(): string {
    const storeDeclarations: string[] = [];
    const relationDeclarations: string[] = [];

    for (const cls of this.definition.classes) {
      const safe = safeName(cls.label);
      storeDeclarations.push(
        `const ${safe}Store = new Map<string, Record<string, unknown>>();`
      );

      for (const prop of cls.objectProperties) {
        const relName = safeName(prop.label);
        relationDeclarations.push(
          `const ${safe}_${relName}_relations = new Map<string, Set<string>>();`
        );
      }
    }

    // Pre-populate individuals
    const prePopulate: string[] = [];
    for (const ind of this.definition.individuals) {
      const cls = this.definition.classes.find((c) => c.uri === ind.classUri);
      if (!cls) continue;
      const safe = safeName(cls.label);
      const propsStr = JSON.stringify(ind.properties);
      prePopulate.push(
        `${safe}Store.set('${safeName(ind.label)}', { id: '${safeName(ind.label)}', ...${propsStr} });`
      );
    }

    return `// ============== IN-MEMORY STORES ==============

${storeDeclarations.join('\n')}

// Relationship stores (source ID -> set of target IDs)
${relationDeclarations.join('\n')}

// Pre-populated individuals
${prePopulate.length > 0 ? prePopulate.join('\n') : '// No pre-populated data'}
`;
  }

  /**
   * Generate health check tool.
   */
  private generateHealthCheck(serverName: string): string {
    const classList = this.definition.classes.map((c) => `'${c.label}'`).join(', ');

    return `// ============== HEALTH CHECK ==============

server.tool(
  'health_check',
  'Check server status and list available ontology classes',
  {},
  async () => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'healthy',
          server: '${serverName}',
          ontology: '${this.definition.name}',
          classes: [${classList}],
          timestamp: new Date().toISOString(),
        })
      }]
    };
  }
);
`;
  }

  /**
   * Generate CRUD tools for an ontology class.
   */
  private generateClassTools(cls: OntologyClass): string[] {
    const parts: string[] = [];
    const safe = safeName(cls.label);

    parts.push(this.generateCreateTool(cls, safe));
    parts.push(this.generateGetTool(cls, safe));
    parts.push(this.generateUpdateTool(cls, safe));
    parts.push(this.generateDeleteTool(cls, safe));
    parts.push(this.generateListTool(cls, safe));

    return parts;
  }

  private generateCreateTool(cls: OntologyClass, safe: string): string {
    const fieldSchemas = cls.dataProperties
      .map((p) => `    ${safeName(p.label)}: ${rangeToZod(p.range)}.describe('${p.description || p.label}'),`)
      .join('\n');

    return `server.tool(
  'create_${safe}',
  'Create a new ${cls.label} instance',
  {
${fieldSchemas}
  },
  async (params) => {
    try {
      const id = randomUUID();
      const record = { id, ...params };
      ${safe}Store.set(id, record);
      return { content: [{ type: 'text', text: JSON.stringify(record) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
  }

  private generateGetTool(cls: OntologyClass, safe: string): string {
    return `server.tool(
  'get_${safe}',
  'Get a ${cls.label} instance by ID',
  {
    id: z.string().describe('The ID of the ${cls.label} instance'),
  },
  async (params) => {
    try {
      const record = ${safe}Store.get(params.id);
      if (!record) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not found' }) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(record) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
  }

  private generateUpdateTool(cls: OntologyClass, safe: string): string {
    const fieldSchemas = cls.dataProperties
      .map((p) => `    ${safeName(p.label)}: ${rangeToZod(p.range)}.optional().describe('${p.description || p.label}'),`)
      .join('\n');

    return `server.tool(
  'update_${safe}',
  'Update an existing ${cls.label} instance',
  {
    id: z.string().describe('The ID of the ${cls.label} instance to update'),
${fieldSchemas}
  },
  async (params) => {
    try {
      const existing = ${safe}Store.get(params.id);
      if (!existing) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not found' }) }] };
      }
      const { id, ...updates } = params;
      // Remove undefined values
      const cleanUpdates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) cleanUpdates[k] = v;
      }
      const updated = { ...existing, ...cleanUpdates };
      ${safe}Store.set(params.id, updated);
      return { content: [{ type: 'text', text: JSON.stringify(updated) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
  }

  private generateDeleteTool(cls: OntologyClass, safe: string): string {
    return `server.tool(
  'delete_${safe}',
  'Delete a ${cls.label} instance',
  {
    id: z.string().describe('The ID of the ${cls.label} instance to delete'),
  },
  async (params) => {
    try {
      const existed = ${safe}Store.delete(params.id);
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: existed }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
  }

  private generateListTool(cls: OntologyClass, safe: string): string {
    return `server.tool(
  'list_${safe}',
  'List all ${cls.label} instances with optional pagination',
  {
    limit: z.number().optional().describe('Maximum number of records to return'),
    offset: z.number().optional().describe('Number of records to skip'),
  },
  async (params) => {
    try {
      const all = Array.from(${safe}Store.values());
      const offset = params.offset ?? 0;
      const limit = params.limit ?? 100;
      const page = all.slice(offset, offset + limit);
      return { content: [{ type: 'text', text: JSON.stringify({ data: page, total: all.length, count: page.length }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
  }

  /**
   * Generate a relationship linking tool for an object property.
   */
  private generateRelationshipTool(cls: OntologyClass, prop: OntologyProperty): string {
    const sourceSafe = safeName(cls.label);
    const relSafe = safeName(prop.label);
    const targetSafe = safeName(prop.range.replace(/^#/, ''));

    return `server.tool(
  'link_${sourceSafe}_${relSafe}',
  '${prop.description || `Link a ${cls.label} to a ${prop.range.replace(/^#/, '')} via ${prop.label}`}',
  {
    sourceId: z.string().describe('The ID of the ${cls.label} instance'),
    targetId: z.string().describe('The ID of the target ${prop.range.replace(/^#/, '')} instance'),
  },
  async (params) => {
    try {
      // Verify source exists
      if (!${sourceSafe}Store.has(params.sourceId)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Source ${cls.label} not found' }) }] };
      }
      // Verify target exists
      if (!${targetSafe}Store.has(params.targetId)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Target ${prop.range.replace(/^#/, '')} not found' }) }] };
      }
      // Create the link
      if (!${sourceSafe}_${relSafe}_relations.has(params.sourceId)) {
        ${sourceSafe}_${relSafe}_relations.set(params.sourceId, new Set());
      }
      ${sourceSafe}_${relSafe}_relations.get(params.sourceId)!.add(params.targetId);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            linked: true,
            source: params.sourceId,
            relationship: '${prop.label}',
            target: params.targetId,
          })
        }]
      };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
  }

  /**
   * Get tool specifications for documentation and template generation.
   *
   * @returns Array of {@link ToolSpec} objects for all CRUD and relationship tools
   */
  getToolSpecs(): ToolSpec[] {
    const specs: ToolSpec[] = [];

    // Health check
    specs.push(
      createToolSpec({
        name: 'health_check',
        description: 'Check server status and list available ontology classes',
        inputSchema: { type: 'object', properties: {}, required: [] },
      })
    );

    for (const cls of this.definition.classes) {
      const safe = safeName(cls.label);

      // Build properties JSON Schema from data properties
      const propsSchema: Record<string, { type: string; description: string }> = {};
      const requiredFields: string[] = [];
      for (const p of cls.dataProperties) {
        const pName = safeName(p.label);
        propsSchema[pName] = { type: rangeToJsonSchema(p.range), description: p.description || p.label };
        requiredFields.push(pName);
      }

      // CREATE
      specs.push(
        createToolSpec({
          name: `create_${safe}`,
          description: `Create a new ${cls.label} instance`,
          inputSchema: {
            type: 'object',
            properties: propsSchema,
            required: requiredFields,
          },
        })
      );

      // GET
      specs.push(
        createToolSpec({
          name: `get_${safe}`,
          description: `Get a ${cls.label} instance by ID`,
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'string', description: `The ID of the ${cls.label} instance` } },
            required: ['id'],
          },
        })
      );

      // UPDATE
      const optionalPropsSchema: Record<string, { type: string; description: string }> = {
        id: { type: 'string', description: `The ID of the ${cls.label} instance to update` },
      };
      for (const p of cls.dataProperties) {
        const pName = safeName(p.label);
        optionalPropsSchema[pName] = { type: rangeToJsonSchema(p.range), description: p.description || p.label };
      }
      specs.push(
        createToolSpec({
          name: `update_${safe}`,
          description: `Update an existing ${cls.label} instance`,
          inputSchema: {
            type: 'object',
            properties: optionalPropsSchema,
            required: ['id'],
          },
        })
      );

      // DELETE
      specs.push(
        createToolSpec({
          name: `delete_${safe}`,
          description: `Delete a ${cls.label} instance`,
          inputSchema: {
            type: 'object',
            properties: { id: { type: 'string', description: `The ID of the ${cls.label} instance to delete` } },
            required: ['id'],
          },
        })
      );

      // LIST
      specs.push(
        createToolSpec({
          name: `list_${safe}`,
          description: `List all ${cls.label} instances with optional pagination`,
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'integer', description: 'Maximum number of records to return' },
              offset: { type: 'integer', description: 'Number of records to skip' },
            },
            required: [],
          },
        })
      );

      // Relationship tools
      for (const prop of cls.objectProperties) {
        const relSafe = safeName(prop.label);
        const targetLabel = prop.range.replace(/^#/, '');
        specs.push(
          createToolSpec({
            name: `link_${safe}_${relSafe}`,
            description: prop.description || `Link a ${cls.label} to a ${targetLabel} via ${prop.label}`,
            inputSchema: {
              type: 'object',
              properties: {
                sourceId: { type: 'string', description: `The ID of the ${cls.label} instance` },
                targetId: { type: 'string', description: `The ID of the target ${targetLabel} instance` },
              },
              required: ['sourceId', 'targetId'],
            },
          })
        );
      }
    }

    return specs;
  }

  /**
   * Get resource specifications. Each ontology class maps to an MCP resource
   * with a `ontology://<className>` URI.
   *
   * @returns Array of resource spec objects
   */
  getResourceSpecs(): Array<{ uri: string; name: string; description: string; mimeType: string }> {
    return this.definition.classes.map((cls) => ({
      uri: `ontology://${safeName(cls.label)}`,
      name: cls.label,
      description: cls.description || `${cls.label} ontology class`,
      mimeType: 'application/json',
    }));
  }

  /**
   * Get the ontology definition.
   */
  getDefinition(): OntologyDefinition {
    return this.definition;
  }
}
