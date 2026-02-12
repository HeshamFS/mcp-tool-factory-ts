/**
 * MCP Registry validation for generated servers.
 *
 * Validates that generated servers are compliant with the MCP Registry schema:
 * https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json
 *
 * Provides Zod schemas for server.json validation and helper functions for
 * validating mcpName format, semver versions, and complete generated server
 * directories.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Valid MCP name patterns.
 *
 * The mcpName field must follow one of these patterns:
 * - io.github.<username>/<name> - For GitHub-hosted packages
 * - Valid reverse DNS notation (e.g., com.example.myserver)
 */
const MCP_NAME_GITHUB_PATTERN = /^io\.github\.[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i;
const MCP_NAME_DNS_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/i;

/**
 * Environment variable format types as per MCP Registry schema.
 */
export const EnvVarFormatSchema = z.enum(['string', 'number', 'boolean', 'filepath']);

/**
 * Environment variable schema for MCP Registry.
 */
export const EnvironmentVariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isRequired: z.boolean(),
  isSecret: z.boolean().optional(),
  format: EnvVarFormatSchema.optional().default('string'),
});

/**
 * Transport type schema.
 */
export const TransportSchema = z.object({
  type: z.enum(['stdio', 'sse', 'streamableHttp']),
  args: z.array(z.string()).optional(),
});

/**
 * Package schema for MCP Registry.
 */
export const PackageSchema = z.object({
  registryType: z.enum(['npm', 'pip', 'docker', 'cargo']),
  identifier: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/, {
    message: 'Version must be valid semver (e.g., 1.0.0, 1.0.0-beta.1)',
  }),
  transport: TransportSchema,
  environmentVariables: z.array(EnvironmentVariableSchema).optional(),
});

/**
 * Repository schema.
 */
export const RepositorySchema = z.object({
  url: z.string().url().optional(),
  source: z.enum(['github', 'gitlab', 'bitbucket', 'other']).optional(),
});

/**
 * Tool definition schema for server.json.
 * Note: This is metadata only - the actual tool schemas are in the server code.
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

/**
 * Full server.json Zod schema for MCP Registry validation.
 *
 * Validates the top-level structure including name, description, semver version,
 * optional repository, packages array (min 1), and optional tools metadata.
 */
export const ServerJsonSchema = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/, {
    message: 'Version must be valid semver (e.g., 1.0.0, 1.0.0-beta.1)',
  }),
  repository: RepositorySchema.optional(),
  packages: z.array(PackageSchema).min(1),
  tools: z.array(ToolDefinitionSchema).optional(),
});

export type ServerJson = z.infer<typeof ServerJsonSchema>;
export type EnvironmentVariable = z.infer<typeof EnvironmentVariableSchema>;
export type Package = z.infer<typeof PackageSchema>;

/**
 * Validation result for registry compliance.
 */
export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an mcpName for registry compliance.
 *
 * @param mcpName - The MCP name to validate
 * @returns Validation result
 */
export function validateMcpName(mcpName: string): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!mcpName || mcpName.trim().length === 0) {
    errors.push('mcpName is required for MCP Registry publishing');
    return { valid: false, errors, warnings };
  }

  const trimmed = mcpName.trim();

  // Check for GitHub format
  if (trimmed.startsWith('io.github.')) {
    if (!MCP_NAME_GITHUB_PATTERN.test(trimmed)) {
      errors.push(
        `Invalid GitHub mcpName format. Expected: io.github.<username>/<name> (lowercase, alphanumeric with hyphens). Got: ${trimmed}`
      );
    }
  }
  // Check for reverse DNS format
  else if (MCP_NAME_DNS_PATTERN.test(trimmed)) {
    // Valid DNS format - no issues
  } else {
    errors.push(
      `Invalid mcpName format. Must be either io.github.<username>/<name> or valid reverse DNS notation. Got: ${trimmed}`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a version string for semver compliance.
 *
 * @param version - The version string to validate
 * @returns Validation result
 */
export function validateVersion(version: string): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const semverPattern = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

  if (!semverPattern.test(version)) {
    errors.push(`Version must be valid semver (e.g., 1.0.0, 1.0.0-beta.1). Got: ${version}`);
  }

  // Warn about pre-1.0 versions
  if (version.startsWith('0.')) {
    warnings.push('Version is pre-1.0 - consider using 1.0.0 for production releases');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a server.json object for MCP Registry compliance.
 *
 * @param serverJson - The server.json content to validate
 * @returns Validation result with errors and warnings
 */
export function validateServerJson(serverJson: unknown): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse with Zod
  const result = ServerJsonSchema.safeParse(serverJson);

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return { valid: false, errors, warnings };
  }

  const data = result.data;

  // Additional validations beyond schema

  // Validate mcpName format
  const nameResult = validateMcpName(data.name);
  errors.push(...nameResult.errors);
  warnings.push(...nameResult.warnings);

  // Validate version
  const versionResult = validateVersion(data.version);
  errors.push(...versionResult.errors);
  warnings.push(...versionResult.warnings);

  // Check for environment variables in packages
  for (const pkg of data.packages) {
    if (pkg.environmentVariables) {
      for (const envVar of pkg.environmentVariables) {
        // Warn about non-secret API keys
        if (
          envVar.name.toLowerCase().includes('key') ||
          envVar.name.toLowerCase().includes('secret') ||
          envVar.name.toLowerCase().includes('token')
        ) {
          if (!envVar.isSecret) {
            warnings.push(
              `Environment variable "${envVar.name}" appears to be sensitive but isSecret is not set`
            );
          }
        }

        // Check for legacy "required" field (common mistake)
        // Cast to Record to check for arbitrary properties not in the schema
        const envVarRecord = envVar as Record<string, unknown>;
        if ('required' in envVarRecord && !('isRequired' in envVarRecord)) {
          errors.push(
            `Environment variable "${envVar.name}" uses deprecated "required" field. Use "isRequired" instead.`
          );
        }
      }
    }
  }

  // Check for repository URL
  if (!data.repository?.url) {
    warnings.push('Repository URL is missing - recommended for MCP Registry publishing');
  }

  // Check for tools array
  if (!data.tools || data.tools.length === 0) {
    warnings.push('No tools defined in server.json - add tool definitions for better discoverability');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate a generated server directory for MCP Registry compliance.
 *
 * @param files - Map of file paths to contents
 * @returns Validation result
 */
export function validateGeneratedServerForRegistry(
  files: Record<string, string>
): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required files
  const requiredFiles = ['server.json', 'package.json', 'README.md'];
  for (const file of requiredFiles) {
    if (!files[file]) {
      errors.push(`Missing required file for MCP Registry: ${file}`);
    }
  }

  // Validate server.json
  if (files['server.json']) {
    try {
      const serverJson = JSON.parse(files['server.json']);
      const serverResult = validateServerJson(serverJson);
      errors.push(...serverResult.errors);
      warnings.push(...serverResult.warnings);
    } catch (e) {
      errors.push(`Invalid JSON in server.json: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Validate package.json has mcpName
  if (files['package.json']) {
    try {
      const packageJson = JSON.parse(files['package.json']);
      if (!packageJson.mcpName) {
        warnings.push('package.json is missing mcpName field - recommended for MCP Registry');
      } else {
        const nameResult = validateMcpName(packageJson.mcpName);
        errors.push(...nameResult.errors.map((e) => `package.json mcpName: ${e}`));
        warnings.push(...nameResult.warnings.map((w) => `package.json mcpName: ${w}`));
      }
    } catch (e) {
      errors.push(`Invalid JSON in package.json: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
