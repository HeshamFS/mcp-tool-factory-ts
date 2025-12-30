/**
 * Dependency management utilities for generated MCP servers.
 *
 * Provides npm package version lookup and dependency resolution.
 */

import https from 'https';

/**
 * Package version information.
 */
export interface PackageVersion {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: string;
}

/**
 * Dependency category.
 */
export type DependencyCategory =
  | 'core'
  | 'database'
  | 'http'
  | 'auth'
  | 'utility'
  | 'testing'
  | 'dev';

/**
 * Known package versions for offline use.
 */
export const KNOWN_VERSIONS: Record<string, string> = {
  // MCP SDK
  '@modelcontextprotocol/sdk': '^1.0.0',

  // Validation
  zod: '^3.22.0',

  // HTTP clients
  axios: '^1.6.0',
  'node-fetch': '^3.3.0',

  // Database
  'better-sqlite3': '^11.0.0',
  pg: '^8.11.0',
  '@types/pg': '^8.10.0',
  '@types/better-sqlite3': '^7.6.0',

  // Auth
  jsonwebtoken: '^9.0.0',
  '@types/jsonwebtoken': '^9.0.0',

  // Utilities
  lodash: '^4.17.21',
  '@types/lodash': '^4.14.0',
  dayjs: '^1.11.0',
  uuid: '^9.0.0',
  '@types/uuid': '^9.0.0',

  // Logging
  pino: '^8.16.0',
  winston: '^3.11.0',

  // Testing
  jest: '^29.7.0',
  '@types/jest': '^29.5.0',
  'ts-jest': '^29.1.0',
  vitest: '^1.0.0',

  // Dev tools
  typescript: '^5.3.0',
  tsx: '^4.6.0',
  tsup: '^8.0.0',
  eslint: '^8.55.0',
  prettier: '^3.1.0',
};

/**
 * Get the latest version of an npm package.
 *
 * @param packageName - Name of the npm package
 * @returns Package version info or null if not found
 */
export async function getLatestVersion(packageName: string): Promise<PackageVersion | null> {
  // First check known versions for speed
  if (KNOWN_VERSIONS[packageName]) {
    return {
      name: packageName,
      version: KNOWN_VERSIONS[packageName]!,
    };
  }

  // Query npm registry
  return new Promise((resolve) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;

    https
      .get(url, { headers: { Accept: 'application/json' } }, (res) => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const pkg = JSON.parse(data);
            resolve({
              name: packageName,
              version: `^${pkg.version}`,
              description: pkg.description,
              homepage: pkg.homepage,
              repository:
                typeof pkg.repository === 'object' ? pkg.repository.url : pkg.repository,
            });
          } catch {
            resolve(null);
          }
        });
      })
      .on('error', () => {
        resolve(null);
      });
  });
}

/**
 * Get the known version for a package (sync).
 *
 * @param packageName - Name of the npm package
 * @returns Version string or "latest" if unknown
 */
export function getKnownVersion(packageName: string): string {
  return KNOWN_VERSIONS[packageName] ?? 'latest';
}

/**
 * Core dependencies required for all generated servers.
 */
export const CORE_DEPENDENCIES: Record<string, string> = {
  '@modelcontextprotocol/sdk': KNOWN_VERSIONS['@modelcontextprotocol/sdk']!,
  zod: KNOWN_VERSIONS['zod']!,
};

/**
 * Core dev dependencies for all generated servers.
 */
export const CORE_DEV_DEPENDENCIES: Record<string, string> = {
  typescript: KNOWN_VERSIONS['typescript']!,
  tsx: KNOWN_VERSIONS['tsx']!,
  '@types/node': '^20.10.0',
};

/**
 * Merge dependencies with deduplication.
 *
 * Later dependencies take precedence if there are conflicts.
 *
 * @param depsArrays - Arrays of dependency records
 * @returns Merged dependency record
 */
export function mergeDependencies(
  ...depsArrays: Record<string, string>[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const deps of depsArrays) {
    for (const [name, version] of Object.entries(deps)) {
      result[name] = version;
    }
  }

  return result;
}

/**
 * Categorize dependencies by their purpose.
 *
 * @param dependencies - List of dependency names
 * @returns Map of category to dependencies
 */
export function categorizeDependencies(
  dependencies: string[]
): Record<DependencyCategory, string[]> {
  const result: Record<DependencyCategory, string[]> = {
    core: [],
    database: [],
    http: [],
    auth: [],
    utility: [],
    testing: [],
    dev: [],
  };

  for (const dep of dependencies) {
    if (
      dep.includes('mcp') ||
      dep === 'zod' ||
      dep === 'commander' ||
      dep === 'chalk'
    ) {
      result.core.push(dep);
    } else if (
      dep.includes('sqlite') ||
      dep.includes('pg') ||
      dep.includes('mysql') ||
      dep.includes('mongodb') ||
      dep.includes('prisma')
    ) {
      result.database.push(dep);
    } else if (
      dep.includes('axios') ||
      dep.includes('fetch') ||
      dep.includes('request') ||
      dep.includes('http')
    ) {
      result.http.push(dep);
    } else if (
      dep.includes('jwt') ||
      dep.includes('oauth') ||
      dep.includes('passport') ||
      dep.includes('bcrypt')
    ) {
      result.auth.push(dep);
    } else if (
      dep.includes('jest') ||
      dep.includes('vitest') ||
      dep.includes('mocha') ||
      dep.includes('chai')
    ) {
      result.testing.push(dep);
    } else if (
      dep.includes('typescript') ||
      dep.includes('eslint') ||
      dep.includes('prettier') ||
      dep.includes('tsup') ||
      dep.includes('tsx')
    ) {
      result.dev.push(dep);
    } else {
      result.utility.push(dep);
    }
  }

  return result;
}

/**
 * Generate a package.json dependencies section.
 *
 * @param toolDependencies - Dependencies from tool specs
 * @param includeCore - Whether to include core dependencies
 * @returns Dependencies and devDependencies records
 */
export function generatePackageDependencies(
  toolDependencies: string[],
  includeCore: boolean = true
): { dependencies: Record<string, string>; devDependencies: Record<string, string> } {
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  // Add core dependencies
  if (includeCore) {
    Object.assign(dependencies, CORE_DEPENDENCIES);
    Object.assign(devDependencies, CORE_DEV_DEPENDENCIES);
  }

  // Categorize tool dependencies
  const categorized = categorizeDependencies(toolDependencies);

  // Add tool dependencies with versions
  for (const category of Object.keys(categorized) as DependencyCategory[]) {
    for (const dep of categorized[category]) {
      const version = getKnownVersion(dep);

      if (category === 'testing' || category === 'dev') {
        devDependencies[dep] = version;
        // Add types packages for dev deps
        if (!dep.startsWith('@types/') && KNOWN_VERSIONS[`@types/${dep}`]) {
          devDependencies[`@types/${dep}`] = KNOWN_VERSIONS[`@types/${dep}`]!;
        }
      } else {
        dependencies[dep] = version;
        // Add types packages
        if (!dep.startsWith('@types/') && KNOWN_VERSIONS[`@types/${dep}`]) {
          devDependencies[`@types/${dep}`] = KNOWN_VERSIONS[`@types/${dep}`]!;
        }
      }
    }
  }

  return { dependencies, devDependencies };
}

/**
 * Validate that a dependency string is a valid npm package name.
 *
 * @param name - Package name to validate
 * @returns True if the name is valid
 */
export function isValidPackageName(name: string): boolean {
  // npm package name rules
  if (!name || name.length > 214) {
    return false;
  }

  // Scoped packages
  if (name.startsWith('@')) {
    const parts = name.split('/');
    if (parts.length !== 2) {
      return false;
    }
    // Validate scope and name
    return parts.every((part) => /^[a-z0-9][-a-z0-9._]*$/.test(part ?? ''));
  }

  // Regular packages
  return /^[a-z0-9][-a-z0-9._]*$/.test(name);
}
