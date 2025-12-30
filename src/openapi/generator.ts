/**
 * OpenAPI Server Generator for MCP Tool Factory.
 */

import type { ToolSpec } from '../models/tool-spec.js';
import { createToolSpec } from '../models/tool-spec.js';

/**
 * Authentication type.
 */
export enum AuthType {
  NONE = 'none',
  API_KEY = 'api_key',
  BEARER = 'bearer',
  OAUTH2 = 'oauth2',
  BASIC = 'basic',
}

/**
 * Authentication configuration.
 */
export interface AuthConfig {
  type: AuthType;
  envVarName: string;
  headerName?: string;
  paramLocation?: 'header' | 'query' | 'cookie';
}

/**
 * Endpoint specification.
 */
export interface EndpointSpec {
  name: string;
  description: string;
  method: string;
  path: string;
  parameters: ParameterSpec[];
  requestBody?: RequestBodySpec;
  responses: Record<string, ResponseSpec>;
}

interface ParameterSpec {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description?: string;
}

interface RequestBodySpec {
  required: boolean;
  contentType: string;
  schema: Record<string, unknown>;
}

interface ResponseSpec {
  description: string;
  schema?: Record<string, unknown>;
}

/**
 * Generator for creating MCP servers from OpenAPI specifications.
 */
export class OpenAPIServerGenerator {
  private spec: Record<string, unknown>;
  private baseUrl: string;
  private authConfigs: AuthConfig[] = [];
  private endpoints: EndpointSpec[] = [];

  constructor(openapiSpec: Record<string, unknown>, baseUrl?: string) {
    this.spec = openapiSpec;
    this.baseUrl = baseUrl ?? this.detectBaseUrl();
    this.parseSpec();
  }

  /**
   * Detect base URL from OpenAPI spec.
   */
  private detectBaseUrl(): string {
    const servers = this.spec.servers as Array<{ url: string }> | undefined;
    if (servers && servers.length > 0 && servers[0]?.url) {
      return servers[0].url;
    }
    return 'http://localhost:8080';
  }

  /**
   * Parse the OpenAPI specification.
   */
  private parseSpec(): void {
    this.parseSecuritySchemes();
    this.parseEndpoints();
  }

  /**
   * Parse security schemes from the spec.
   */
  private parseSecuritySchemes(): void {
    const components = this.spec.components as Record<string, unknown> | undefined;
    const securitySchemes = components?.securitySchemes as Record<string, unknown> | undefined;

    if (!securitySchemes) return;

    for (const [name, scheme] of Object.entries(securitySchemes)) {
      const schemeObj = scheme as Record<string, unknown>;
      const type = schemeObj.type as string;
      const inParam = schemeObj.in as string | undefined;
      const schemeName = schemeObj.scheme as string | undefined;

      if (type === 'apiKey') {
        this.authConfigs.push({
          type: AuthType.API_KEY,
          envVarName: `${name.toUpperCase()}_API_KEY`,
          headerName: schemeObj.name as string,
          paramLocation: inParam as 'header' | 'query' | 'cookie',
        });
      } else if (type === 'http' && schemeName === 'bearer') {
        this.authConfigs.push({
          type: AuthType.BEARER,
          envVarName: `${name.toUpperCase()}_TOKEN`,
        });
      } else if (type === 'http' && schemeName === 'basic') {
        this.authConfigs.push({
          type: AuthType.BASIC,
          envVarName: `${name.toUpperCase()}_CREDENTIALS`,
        });
      } else if (type === 'oauth2') {
        this.authConfigs.push({
          type: AuthType.OAUTH2,
          envVarName: `${name.toUpperCase()}_TOKEN`,
        });
      }
    }
  }

  /**
   * Parse endpoints from the spec.
   */
  private parseEndpoints(): void {
    const paths = this.spec.paths as Record<string, Record<string, unknown>> | undefined;
    if (!paths) return;

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          continue;
        }

        const op = operation as Record<string, unknown>;
        const operationId = op.operationId as string | undefined;
        const summary = op.summary as string | undefined;
        const description = op.description as string | undefined;

        // Generate endpoint name
        let name = operationId;
        if (!name) {
          name = `${method}_${path.replace(/\//g, '_').replace(/[{}]/g, '')}`;
        }

        // Parse parameters
        const parameters: ParameterSpec[] = [];
        const params = op.parameters as Array<Record<string, unknown>> | undefined;
        if (params) {
          for (const param of params) {
            const schema = param.schema as Record<string, unknown> | undefined;
            parameters.push({
              name: param.name as string,
              in: param.in as 'path' | 'query' | 'header' | 'cookie',
              required: param.required as boolean ?? false,
              type: schema?.type as string ?? 'string',
              description: param.description as string | undefined,
            });
          }
        }

        // Parse request body
        let requestBody: RequestBodySpec | undefined;
        const reqBody = op.requestBody as Record<string, unknown> | undefined;
        if (reqBody) {
          const content = reqBody.content as Record<string, unknown> | undefined;
          if (content) {
            const jsonContent = content['application/json'] as Record<string, unknown> | undefined;
            if (jsonContent) {
              requestBody = {
                required: reqBody.required as boolean ?? false,
                contentType: 'application/json',
                schema: jsonContent.schema as Record<string, unknown> ?? {},
              };
            }
          }
        }

        this.endpoints.push({
          name,
          description: summary ?? description ?? '',
          method: method.toUpperCase(),
          path,
          parameters,
          requestBody,
          responses: {},
        });
      }
    }
  }

  /**
   * Generate the MCP server code.
   */
  generateServerCode(serverName: string): string {
    const parts: string[] = [
      '/**',
      ` * Auto-generated MCP server: ${serverName}`,
      ' * Generated from OpenAPI specification',
      ' */',
      '',
      "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';",
      "import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';",
      "import { z } from 'zod';",
      "import axios from 'axios';",
      '',
      `const BASE_URL = '${this.baseUrl}';`,
      '',
      'const server = new McpServer({',
      `  name: '${serverName}',`,
      "  version: '1.0.0',",
      '});',
      '',
    ];

    // Add auth configuration
    if (this.authConfigs.length > 0) {
      parts.push('// ============== AUTH CONFIGURATION ==============');
      parts.push('');
      parts.push('const AUTH_CONFIG: Record<string, string | undefined> = {');
      for (const auth of this.authConfigs) {
        parts.push(`  '${auth.envVarName}': process.env['${auth.envVarName}'],`);
      }
      parts.push('};');
      parts.push('');
      parts.push('function getAuth(key: string): string | undefined {');
      parts.push('  return AUTH_CONFIG[key];');
      parts.push('}');
      parts.push('');
      parts.push('function requireAuth(key: string): string {');
      parts.push('  const value = getAuth(key);');
      parts.push('  if (!value) {');
      parts.push('    throw new Error(`Missing required environment variable: ${key}`);');
      parts.push('  }');
      parts.push('  return value;');
      parts.push('}');
      parts.push('');
    }

    // Add tools
    parts.push('// ============== TOOLS ==============');
    parts.push('');

    for (const endpoint of this.endpoints) {
      parts.push(...this.generateToolCode(endpoint));
    }

    // Add main
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
   * Generate code for a single tool.
   */
  private generateToolCode(endpoint: EndpointSpec): string[] {
    const parts: string[] = [];

    parts.push('server.tool(');
    parts.push(`  '${endpoint.name}',`);
    parts.push(`  '${endpoint.description.replace(/'/g, "\\'")}',`);
    parts.push('  {');

    // Add parameters
    for (const param of endpoint.parameters) {
      const zodType = this.jsonTypeToZod(param.type);
      const desc = param.description ? `.describe('${param.description.replace(/'/g, "\\'")}')` : '';
      const optional = !param.required ? '.optional()' : '';
      parts.push(`    ${param.name}: z.${zodType}()${desc}${optional},`);
    }

    // Add request body schema if present
    if (endpoint.requestBody) {
      parts.push("    body: z.record(z.unknown()).describe('Request body').optional(),");
    }

    parts.push('  },');
    parts.push('  async (params) => {');
    parts.push('    try {');

    // Build URL with path parameters
    parts.push(`      let url = \`\${BASE_URL}${endpoint.path}\`;`);
    for (const param of endpoint.parameters.filter((p) => p.in === 'path')) {
      parts.push(`      url = url.replace('{${param.name}}', String(params.${param.name}));`);
    }

    // Build query parameters
    const queryParams = endpoint.parameters.filter((p) => p.in === 'query');
    if (queryParams.length > 0) {
      parts.push('      const queryParams = new URLSearchParams();');
      for (const param of queryParams) {
        parts.push(`      if (params.${param.name} !== undefined) {`);
        parts.push(`        queryParams.set('${param.name}', String(params.${param.name}));`);
        parts.push('      }');
      }
      parts.push("      if (queryParams.toString()) url += '?' + queryParams.toString();");
    }

    // Build headers
    parts.push('      const headers: Record<string, string> = {};');
    if (this.authConfigs.length > 0) {
      const auth = this.authConfigs[0]!;
      if (auth.type === AuthType.API_KEY && auth.headerName) {
        parts.push(`      const apiKey = getAuth('${auth.envVarName}');`);
        parts.push('      if (apiKey) {');
        parts.push(`        headers['${auth.headerName}'] = apiKey;`);
        parts.push('      }');
      } else if (auth.type === AuthType.BEARER) {
        parts.push(`      const token = getAuth('${auth.envVarName}');`);
        parts.push('      if (token) {');
        parts.push("        headers['Authorization'] = `Bearer ${token}`;");
        parts.push('      }');
      }
    }

    // Make request
    parts.push('');
    parts.push('      const response = await axios({');
    parts.push(`        method: '${endpoint.method}',`);
    parts.push('        url,');
    parts.push('        headers,');
    if (endpoint.requestBody) {
      parts.push('        data: params.body,');
    }
    parts.push('      });');
    parts.push('');
    parts.push('      return {');
    parts.push('        content: [{ type: "text", text: JSON.stringify(response.data) }]');
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
   * Convert JSON Schema type to Zod type.
   */
  private jsonTypeToZod(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'string',
      integer: 'number',
      number: 'number',
      boolean: 'boolean',
      array: 'array(z.unknown())',
      object: 'record(z.unknown())',
    };
    return typeMap[type] || 'unknown';
  }

  /**
   * Get tool specifications for documentation.
   */
  getToolSpecs(): ToolSpec[] {
    return this.endpoints.map((endpoint) =>
      createToolSpec({
        name: endpoint.name,
        description: endpoint.description,
        inputSchema: {
          type: 'object',
          properties: Object.fromEntries(
            endpoint.parameters.map((p) => [
              p.name,
              { type: p.type, description: p.description },
            ])
          ),
          required: endpoint.parameters.filter((p) => p.required).map((p) => p.name),
        },
        dependencies: ['axios'],
      })
    );
  }

  /**
   * Get environment variable names for authentication.
   */
  getAuthEnvVars(): string[] {
    return this.authConfigs.map((a) => a.envVarName);
  }
}
