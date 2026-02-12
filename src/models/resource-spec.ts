/**
 * Resource specification for MCP servers.
 *
 * Resources expose structured data that LLMs can use for context:
 * documents, database records, file trees, API collections, etc.
 *
 * @packageDocumentation
 */

/**
 * Specification for an MCP resource.
 */
export interface ResourceSpec {
  /** Resource URI (e.g., "db://users", "file://config.json") */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description of the resource */
  description: string;
  /** MIME type of the resource content */
  mimeType: string;
  /** Whether the URI is a template (contains {placeholders}) */
  template: boolean;
}

/**
 * Create a ResourceSpec with defaults.
 *
 * Defaults: `mimeType` to `"application/json"`, `template` to `false`.
 *
 * @param partial - Partial spec; `uri`, `name`, and `description` are required
 * @returns Complete ResourceSpec
 */
export function createResourceSpec(
  partial: Partial<ResourceSpec> & Pick<ResourceSpec, 'uri' | 'name' | 'description'>
): ResourceSpec {
  return {
    uri: partial.uri,
    name: partial.name,
    description: partial.description,
    mimeType: partial.mimeType ?? 'application/json',
    template: partial.template ?? false,
  };
}
