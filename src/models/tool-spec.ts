/**
 * JSON Schema type for tool inputs and outputs.
 */
export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchema;
  description?: string;
}

export interface JsonSchemaProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * Specification for a tool to generate.
 */
export interface ToolSpec {
  /** Tool name in snake_case */
  name: string;
  /** Clear description of what the tool does */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: JsonSchema;
  /** Optional JSON Schema for output */
  outputSchema?: JsonSchema | null;
  /** Hints for the LLM about how to implement */
  implementationHints?: string | null;
  /** npm packages required */
  dependencies: string[];
}

/**
 * Create a ToolSpec with defaults.
 */
export function createToolSpec(partial: Partial<ToolSpec> & Pick<ToolSpec, 'name' | 'description'>): ToolSpec {
  return {
    name: partial.name,
    description: partial.description,
    inputSchema: partial.inputSchema ?? { type: 'object', properties: {} },
    outputSchema: partial.outputSchema ?? null,
    implementationHints: partial.implementationHints ?? null,
    dependencies: partial.dependencies ?? [],
  };
}

/**
 * Convert ToolSpec to a plain object for serialization.
 */
export function toolSpecToDict(spec: ToolSpec): Record<string, unknown> {
  return {
    name: spec.name,
    description: spec.description,
    input_schema: spec.inputSchema,
    output_schema: spec.outputSchema,
    implementation_hints: spec.implementationHints,
    dependencies: spec.dependencies,
  };
}
