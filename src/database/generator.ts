/**
 * Database Server Generator for MCP Tool Factory.
 *
 * Generates CRUD tools from database schemas.
 *
 * Supports:
 * - SQLite (better-sqlite3)
 * - PostgreSQL (pg)
 */

import type { ToolSpec } from '../models/tool-spec.js';
import { createToolSpec } from '../models/tool-spec.js';

/**
 * Supported database types.
 */
export enum DatabaseType {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
}

/**
 * Column information.
 */
export interface ColumnInfo {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: unknown;
  foreignKey?: string; // Format: "table.column"
}

/**
 * Convert column data type to TypeScript type.
 */
export function columnToTypeScriptType(column: ColumnInfo): string {
  const typeLower = column.dataType.toLowerCase();

  if (['int', 'integer', 'serial', 'bigint', 'smallint'].some((t) => typeLower.includes(t))) {
    return 'number';
  } else if (['real', 'double', 'float', 'decimal', 'numeric'].some((t) => typeLower.includes(t))) {
    return 'number';
  } else if (typeLower.includes('bool')) {
    return 'boolean';
  } else if (['json', 'jsonb'].some((t) => typeLower.includes(t))) {
    return 'Record<string, unknown>';
  } else if (typeLower.includes('array') || typeLower.includes('[]')) {
    return 'unknown[]';
  } else {
    return 'string';
  }
}

/**
 * Convert column data type to JSON Schema type.
 */
export function columnToJsonSchemaType(column: ColumnInfo): string {
  const tsType = columnToTypeScriptType(column);
  const typeMap: Record<string, string> = {
    number: 'integer',
    boolean: 'boolean',
    'Record<string, unknown>': 'object',
    'unknown[]': 'array',
    string: 'string',
  };
  return typeMap[tsType] ?? 'string';
}

/**
 * Table information.
 */
export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  schema?: string;
}

/**
 * Get primary key column from table.
 */
export function getPrimaryKey(table: TableInfo): ColumnInfo | undefined {
  return table.columns.find((col) => col.isPrimaryKey);
}

/**
 * Get non-primary key columns.
 */
export function getNonPkColumns(table: TableInfo): ColumnInfo[] {
  return table.columns.filter((col) => !col.isPrimaryKey);
}

/**
 * Introspect database schema to extract table information.
 */
export class DatabaseIntrospector {
  dbType: DatabaseType;
  connectionString: string;

  constructor(dbType: DatabaseType, connectionString: string) {
    this.dbType = dbType;
    this.connectionString = connectionString;
  }

  /**
   * Get all tables from the database.
   */
  async getTables(): Promise<TableInfo[]> {
    if (this.dbType === DatabaseType.SQLITE) {
      return this.getSqliteTables();
    } else if (this.dbType === DatabaseType.POSTGRESQL) {
      return this.getPostgresqlTables();
    }
    return [];
  }

  /**
   * Get tables from SQLite database.
   */
  private async getSqliteTables(): Promise<TableInfo[]> {
    try {
      // Dynamic import to avoid requiring the package if not used
      const Database = (await import('better-sqlite3')).default;

      const db = new Database(this.connectionString, { readonly: true });
      const tables: TableInfo[] = [];

      // Get all table names
      const tableRows = db
        .prepare(
          `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
        )
        .all() as Array<{ name: string }>;

      for (const tableRow of tableRows) {
        const tableName = tableRow.name;

        // Get column info using PRAGMA
        const columnRows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: unknown;
          pk: number;
        }>;

        const columns: ColumnInfo[] = columnRows.map((row) => ({
          name: row.name,
          dataType: row.type,
          isNullable: !row.notnull,
          isPrimaryKey: !!row.pk,
          defaultValue: row.dflt_value,
        }));

        // Get foreign keys
        const fkRows = db.prepare(`PRAGMA foreign_key_list(${tableName})`).all() as Array<{
          id: number;
          seq: number;
          table: string;
          from: string;
          to: string;
        }>;

        for (const fkRow of fkRows) {
          const column = columns.find((col) => col.name === fkRow.from);
          if (column) {
            column.foreignKey = `${fkRow.table}.${fkRow.to}`;
          }
        }

        tables.push({ name: tableName, columns });
      }

      db.close();
      return tables;
    } catch (error) {
      if ((error as Error).message.includes('Cannot find module')) {
        console.warn(
          'better-sqlite3 not installed. Install with: npm install better-sqlite3'
        );
      }
      throw error;
    }
  }

  /**
   * Get tables from PostgreSQL database.
   */
  private async getPostgresqlTables(): Promise<TableInfo[]> {
    try {
      // Dynamic import to avoid requiring the package if not used
      const { Pool } = await import('pg');

      const pool = new Pool({ connectionString: this.connectionString });
      const tables: TableInfo[] = [];

      // Get all tables in public schema
      const tableResult = await pool.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`
      );

      for (const tableRow of tableResult.rows) {
        const tableName = tableRow.table_name;

        // Get column info
        const columnResult = await pool.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
          column_default: string | null;
          is_pk: boolean;
        }>(
          `SELECT
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_pk
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
          ) pk ON c.column_name = pk.column_name
          WHERE c.table_name = $1 AND c.table_schema = 'public'
          ORDER BY c.ordinal_position`,
          [tableName]
        );

        const columns: ColumnInfo[] = columnResult.rows.map((row) => ({
          name: row.column_name,
          dataType: row.data_type,
          isNullable: row.is_nullable === 'YES',
          isPrimaryKey: row.is_pk,
          defaultValue: row.column_default,
        }));

        // Get foreign keys
        const fkResult = await pool.query<{
          column_name: string;
          foreign_table: string;
          foreign_column: string;
        }>(
          `SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'`,
          [tableName]
        );

        for (const fkRow of fkResult.rows) {
          const column = columns.find((col) => col.name === fkRow.column_name);
          if (column) {
            column.foreignKey = `${fkRow.foreign_table}.${fkRow.foreign_column}`;
          }
        }

        tables.push({ name: tableName, columns, schema: 'public' });
      }

      await pool.end();
      return tables;
    } catch (error) {
      if ((error as Error).message.includes('Cannot find module')) {
        console.warn('pg not installed. Install with: npm install pg');
      }
      throw error;
    }
  }
}

/**
 * Make a safe function/variable name from table name.
 */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

/**
 * Generator for creating MCP servers from database schemas.
 */
export class DatabaseServerGenerator {
  dbType: DatabaseType;
  connectionString: string;
  tables: TableInfo[] = [];

  constructor(connectionString: string, tables?: TableInfo[]) {
    this.connectionString = connectionString;
    this.dbType = this.detectDatabaseType();
    if (tables) {
      this.tables = tables;
    }
  }

  /**
   * Detect database type from connection string.
   */
  private detectDatabaseType(): DatabaseType {
    if (
      this.connectionString.startsWith('postgresql://') ||
      this.connectionString.startsWith('postgres://')
    ) {
      return DatabaseType.POSTGRESQL;
    }
    return DatabaseType.SQLITE;
  }

  /**
   * Introspect the database schema.
   */
  async introspect(tableNames?: string[]): Promise<void> {
    const introspector = new DatabaseIntrospector(this.dbType, this.connectionString);
    const allTables = await introspector.getTables();

    if (tableNames && tableNames.length > 0) {
      this.tables = allTables.filter((t) => tableNames.includes(t.name));
    } else {
      this.tables = allTables;
    }
  }

  /**
   * Generate the MCP server code.
   */
  generateServerCode(serverName: string): string {
    const imports = this.generateImports();
    const dbSetup = this.generateDbSetup();
    const healthCheck = this.generateHealthCheck(serverName);

    const tools: string[] = [];
    for (const table of this.tables) {
      tools.push(...this.generateTableTools(table));
    }

    return `/**
 * Auto-generated MCP server: ${serverName}
 * Generated from database schema
 */

${imports}

const server = new McpServer({
  name: '${serverName}',
  version: '1.0.0',
});

${dbSetup}

${healthCheck}

// ============== DATABASE TOOLS ==============

${tools.join('\n')}

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
    const imports = [
      "import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';",
      "import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';",
      "import { z } from 'zod';",
    ];

    if (this.dbType === DatabaseType.POSTGRESQL) {
      imports.push("import { Pool } from 'pg';");
    } else {
      imports.push("import Database from 'better-sqlite3';");
    }

    return imports.join('\n');
  }

  /**
   * Generate database connection setup.
   */
  private generateDbSetup(): string {
    if (this.dbType === DatabaseType.SQLITE) {
      const escapedPath = this.connectionString.replace(/\\/g, '\\\\');
      return `// ============== DATABASE CONNECTION ==============

const DATABASE_PATH = process.env.DATABASE_PATH ?? '${escapedPath}';
const db = new Database(DATABASE_PATH);

function getConnection() {
  return db;
}
`;
    } else {
      return `// ============== DATABASE CONNECTION ==============

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function getConnection() {
  return pool.connect();
}
`;
    }
  }

  /**
   * Generate health check tool.
   */
  private generateHealthCheck(serverName: string): string {
    const tableList = this.tables.map((t) => `'${t.name}'`).join(', ');

    return `// ============== HEALTH CHECK ==============

server.tool(
  'health_check',
  'Check database connectivity and list available tables',
  {},
  async () => {
    try {
      ${this.dbType === DatabaseType.SQLITE ? 'const conn = getConnection();' : 'const client = await getConnection();\n      client.release();'}
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'healthy',
            server: '${serverName}',
            database_type: '${this.dbType}',
            tables_available: [${tableList}],
            timestamp: new Date().toISOString(),
          })
        }]
      };
    } catch (e) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'unhealthy',
            error: String(e),
            timestamp: new Date().toISOString(),
          })
        }]
      };
    }
  }
);
`;
  }

  /**
   * Generate CRUD tools for a table.
   */
  private generateTableTools(table: TableInfo): string[] {
    const parts: string[] = [];
    const tableName = table.name;
    const safe = safeName(tableName);
    const pk = getPrimaryKey(table);
    const pkName = pk?.name ?? 'id';
    const pkType = pk ? columnToTypeScriptType(pk) : 'string';

    // GET tool
    if (pk) {
      parts.push(this.generateGetTool(tableName, safe, pkName, pkType));
    }

    // LIST tool
    parts.push(this.generateListTool(tableName, safe));

    // CREATE tool
    parts.push(this.generateCreateTool(table, safe));

    // UPDATE tool
    if (pk) {
      parts.push(this.generateUpdateTool(table, safe, pkName, pkType));
    }

    // DELETE tool
    if (pk) {
      parts.push(this.generateDeleteTool(tableName, safe, pkName, pkType));
    }

    return parts;
  }

  private generateGetTool(
    tableName: string,
    safe: string,
    pkName: string,
    pkType: string
  ): string {
    const zodType = pkType === 'number' ? 'z.number()' : 'z.string()';

    if (this.dbType === DatabaseType.SQLITE) {
      return `server.tool(
  'get_${safe}',
  'Get a single ${tableName} record by ${pkName}',
  {
    ${pkName}: ${zodType}.describe('The ${pkName} of the record'),
  },
  async (params) => {
    try {
      const db = getConnection();
      const row = db.prepare('SELECT * FROM ${tableName} WHERE ${pkName} = ?').get(params.${pkName});
      if (!row) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not found' }) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(row) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
    } else {
      return `server.tool(
  'get_${safe}',
  'Get a single ${tableName} record by ${pkName}',
  {
    ${pkName}: ${zodType}.describe('The ${pkName} of the record'),
  },
  async (params) => {
    const client = await getConnection();
    try {
      const result = await client.query('SELECT * FROM ${tableName} WHERE ${pkName} = $1', [params.${pkName}]);
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not found' }) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result.rows[0]) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    } finally {
      client.release();
    }
  }
);
`;
    }
  }

  private generateListTool(tableName: string, safe: string): string {
    if (this.dbType === DatabaseType.SQLITE) {
      return `server.tool(
  'list_${safe}',
  'List ${tableName} records with optional filtering and pagination',
  {
    limit: z.number().optional().describe('Maximum number of records to return'),
    offset: z.number().optional().describe('Number of records to skip'),
  },
  async (params) => {
    try {
      const db = getConnection();
      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;
      const rows = db.prepare('SELECT * FROM ${tableName} LIMIT ? OFFSET ?').all(limit, offset);
      return { content: [{ type: 'text', text: JSON.stringify({ data: rows, count: rows.length }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
    } else {
      return `server.tool(
  'list_${safe}',
  'List ${tableName} records with optional filtering and pagination',
  {
    limit: z.number().optional().describe('Maximum number of records to return'),
    offset: z.number().optional().describe('Number of records to skip'),
  },
  async (params) => {
    const client = await getConnection();
    try {
      const limit = params.limit ?? 100;
      const offset = params.offset ?? 0;
      const result = await client.query('SELECT * FROM ${tableName} LIMIT $1 OFFSET $2', [limit, offset]);
      return { content: [{ type: 'text', text: JSON.stringify({ data: result.rows, count: result.rows.length }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    } finally {
      client.release();
    }
  }
);
`;
    }
  }

  private generateCreateTool(table: TableInfo, safe: string): string {
    const nonPkColumns = getNonPkColumns(table);
    const columnNames = nonPkColumns.map((c) => c.name).join(', ');
    const placeholders =
      this.dbType === DatabaseType.SQLITE
        ? nonPkColumns.map(() => '?').join(', ')
        : nonPkColumns.map((_, i) => `$${i + 1}`).join(', ');

    if (this.dbType === DatabaseType.SQLITE) {
      return `server.tool(
  'create_${safe}',
  'Create a new ${table.name} record',
  {
    data: z.record(z.unknown()).describe('The record data to create'),
  },
  async (params) => {
    try {
      const db = getConnection();
      const data = params.data as Record<string, unknown>;
      const columns = [${nonPkColumns.map((c) => `'${c.name}'`).join(', ')}];
      const values = columns.map(c => data[c]);
      const result = db.prepare('INSERT INTO ${table.name} (${columnNames}) VALUES (${placeholders})').run(...values);
      return { content: [{ type: 'text', text: JSON.stringify({ id: result.lastInsertRowid, changes: result.changes }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
    } else {
      return `server.tool(
  'create_${safe}',
  'Create a new ${table.name} record',
  {
    data: z.record(z.unknown()).describe('The record data to create'),
  },
  async (params) => {
    const client = await getConnection();
    try {
      const data = params.data as Record<string, unknown>;
      const columns = [${nonPkColumns.map((c) => `'${c.name}'`).join(', ')}];
      const values = columns.map(c => data[c]);
      const result = await client.query(
        'INSERT INTO ${table.name} (${columnNames}) VALUES (${placeholders}) RETURNING *',
        values
      );
      return { content: [{ type: 'text', text: JSON.stringify(result.rows[0]) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    } finally {
      client.release();
    }
  }
);
`;
    }
  }

  private generateUpdateTool(
    table: TableInfo,
    safe: string,
    pkName: string,
    pkType: string
  ): string {
    const zodType = pkType === 'number' ? 'z.number()' : 'z.string()';

    if (this.dbType === DatabaseType.SQLITE) {
      return `server.tool(
  'update_${safe}',
  'Update an existing ${table.name} record',
  {
    ${pkName}: ${zodType}.describe('The ${pkName} of the record to update'),
    data: z.record(z.unknown()).describe('The fields to update'),
  },
  async (params) => {
    try {
      const db = getConnection();
      const data = params.data as Record<string, unknown>;
      const sets = Object.keys(data).map(k => \`\${k} = ?\`).join(', ');
      const values = [...Object.values(data), params.${pkName}];
      const result = db.prepare(\`UPDATE ${table.name} SET \${sets} WHERE ${pkName} = ?\`).run(...values);
      return { content: [{ type: 'text', text: JSON.stringify({ changes: result.changes }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
    } else {
      return `server.tool(
  'update_${safe}',
  'Update an existing ${table.name} record',
  {
    ${pkName}: ${zodType}.describe('The ${pkName} of the record to update'),
    data: z.record(z.unknown()).describe('The fields to update'),
  },
  async (params) => {
    const client = await getConnection();
    try {
      const data = params.data as Record<string, unknown>;
      const keys = Object.keys(data);
      const sets = keys.map((k, i) => \`\${k} = $\${i + 1}\`).join(', ');
      const values = [...Object.values(data), params.${pkName}];
      const result = await client.query(
        \`UPDATE ${table.name} SET \${sets} WHERE ${pkName} = $\${keys.length + 1} RETURNING *\`,
        values
      );
      return { content: [{ type: 'text', text: JSON.stringify(result.rows[0]) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    } finally {
      client.release();
    }
  }
);
`;
    }
  }

  private generateDeleteTool(
    tableName: string,
    safe: string,
    pkName: string,
    pkType: string
  ): string {
    const zodType = pkType === 'number' ? 'z.number()' : 'z.string()';

    if (this.dbType === DatabaseType.SQLITE) {
      return `server.tool(
  'delete_${safe}',
  'Delete a ${tableName} record',
  {
    ${pkName}: ${zodType}.describe('The ${pkName} of the record to delete'),
  },
  async (params) => {
    try {
      const db = getConnection();
      const result = db.prepare('DELETE FROM ${tableName} WHERE ${pkName} = ?').run(params.${pkName});
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: result.changes > 0, changes: result.changes }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    }
  }
);
`;
    } else {
      return `server.tool(
  'delete_${safe}',
  'Delete a ${tableName} record',
  {
    ${pkName}: ${zodType}.describe('The ${pkName} of the record to delete'),
  },
  async (params) => {
    const client = await getConnection();
    try {
      const result = await client.query('DELETE FROM ${tableName} WHERE ${pkName} = $1 RETURNING *', [params.${pkName}]);
      return { content: [{ type: 'text', text: JSON.stringify({ deleted: result.rowCount > 0, row: result.rows[0] }) }] };
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: String(e) }) }] };
    } finally {
      client.release();
    }
  }
);
`;
    }
  }

  /**
   * Get the number of tables introspected.
   */
  getTableCount(): number {
    return this.tables.length;
  }

  /**
   * Get tool specifications with full inputSchema for template generation.
   */
  getToolSpecs(): ToolSpec[] {
    const specs: ToolSpec[] = [];
    const deps = this.dbType === DatabaseType.POSTGRESQL ? ['pg'] : ['better-sqlite3'];

    // Add health check tool
    specs.push(
      createToolSpec({
        name: 'health_check',
        description: 'Check database connectivity and list available tables',
        dependencies: deps,
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      })
    );

    for (const table of this.tables) {
      const pk = getPrimaryKey(table);
      const pkName = pk?.name ?? 'id';
      const pkType = pk ? columnToJsonSchemaType(pk) : 'string';
      const safe = safeName(table.name);

      // GET tool
      if (pk) {
        specs.push(
          createToolSpec({
            name: `get_${safe}`,
            description: `Get a single ${table.name} record by ${pkName}`,
            dependencies: deps,
            inputSchema: {
              type: 'object',
              properties: {
                [pkName]: {
                  type: pkType,
                  description: `The ${pkName} of the record`,
                },
              },
              required: [pkName],
            },
          })
        );
      }

      // LIST tool
      specs.push(
        createToolSpec({
          name: `list_${safe}`,
          description: `List ${table.name} records with optional filtering and pagination`,
          dependencies: deps,
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'integer',
                description: 'Maximum number of records to return',
              },
              offset: {
                type: 'integer',
                description: 'Number of records to skip',
              },
            },
            required: [],
          },
        })
      );

      // CREATE tool
      specs.push(
        createToolSpec({
          name: `create_${safe}`,
          description: `Create a new ${table.name} record`,
          dependencies: deps,
          inputSchema: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                description: 'The record data to create',
              },
            },
            required: ['data'],
          },
        })
      );

      // UPDATE tool
      if (pk) {
        specs.push(
          createToolSpec({
            name: `update_${safe}`,
            description: `Update an existing ${table.name} record`,
            dependencies: deps,
            inputSchema: {
              type: 'object',
              properties: {
                [pkName]: {
                  type: pkType,
                  description: `The ${pkName} of the record to update`,
                },
                data: {
                  type: 'object',
                  description: 'The fields to update',
                },
              },
              required: [pkName, 'data'],
            },
          })
        );
      }

      // DELETE tool
      if (pk) {
        specs.push(
          createToolSpec({
            name: `delete_${safe}`,
            description: `Delete a ${table.name} record`,
            dependencies: deps,
            inputSchema: {
              type: 'object',
              properties: {
                [pkName]: {
                  type: pkType,
                  description: `The ${pkName} of the record to delete`,
                },
              },
              required: [pkName],
            },
          })
        );
      }
    }

    return specs;
  }

  /**
   * Get the database type.
   */
  getDatabaseType(): DatabaseType {
    return this.dbType;
  }

  /**
   * Get the connection string.
   */
  getConnectionString(): string {
    return this.connectionString;
  }
}
