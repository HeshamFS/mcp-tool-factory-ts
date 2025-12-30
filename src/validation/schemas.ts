import { z } from 'zod';

/**
 * Type for JSON Schema property (used for recursive type).
 */
export interface JsonSchemaPropertyType {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: JsonSchemaPropertyType;
  properties?: Record<string, JsonSchemaPropertyType>;
  required?: string[];
}

/**
 * Schema for JSON Schema property.
 */
export const JsonSchemaPropertySchema: z.ZodType<JsonSchemaPropertyType> = z.lazy(() =>
  z.object({
    type: z.string(),
    description: z.string().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.string()).optional(),
    items: JsonSchemaPropertySchema.optional(),
    properties: z.record(JsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
  })
);

/**
 * Type for JSON Schema.
 */
export interface JsonSchemaType {
  type: string;
  properties?: Record<string, JsonSchemaPropertyType>;
  required?: string[];
  items?: JsonSchemaPropertyType;
  description?: string;
}

/**
 * Schema for JSON Schema.
 */
export const JsonSchemaSchema: z.ZodType<JsonSchemaType> = z.lazy(() =>
  z.object({
    type: z.string(),
    properties: z.record(JsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    items: JsonSchemaPropertySchema.optional(),
    description: z.string().optional(),
  })
);

/**
 * Schema for tool specification from LLM response.
 */
export const ToolSpecSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .transform((v) => {
      // Convert to lowercase and replace spaces/hyphens with underscores
      let name = v.toLowerCase().replace(/-/g, '_').replace(/ /g, '_');
      // Remove non-alphanumeric characters except underscores
      name = name.replace(/[^a-z0-9_]/g, '');
      // Ensure starts with a letter
      if (name && !/^[a-z]/.test(name)) {
        name = 'tool_' + name;
      }
      return name || 'unnamed_tool';
    }),

  description: z.string().min(1).default('No description provided'),

  input_schema: z
    .record(z.unknown())
    .default({})
    .transform((v) => {
      // Ensure required fields
      const schema = { ...v } as Record<string, unknown>;
      if (!schema.type) {
        schema.type = 'object';
      }
      if (!schema.properties) {
        schema.properties = {};
      }
      return schema;
    }),

  output_schema: z.record(z.unknown()).nullable().optional(),

  implementation_hints: z.string().nullable().optional(),

  dependencies: z
    .array(z.string())
    .default([])
    .transform((deps) => {
      // Clean up dependency names
      return deps
        .filter((dep): dep is string => typeof dep === 'string')
        .map((dep) => {
          // Remove version specifiers
          return dep.split('>=')[0]?.split('==')[0]?.split('<')[0]?.trim() ?? '';
        })
        .filter((dep) => dep.length > 0);
    }),
});

/**
 * Type inferred from the ToolSpecSchema.
 */
export type ValidatedToolSpec = z.infer<typeof ToolSpecSchema>;

/**
 * Validate a list of tool specifications.
 */
export function validateToolSpecs(
  specsData: unknown[]
): { valid: ValidatedToolSpec[]; errors: string[] } {
  const valid: ValidatedToolSpec[] = [];
  const errors: string[] = [];

  for (let i = 0; i < specsData.length; i++) {
    const spec = specsData[i];
    try {
      const validated = ToolSpecSchema.parse(spec);
      valid.push(validated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        errors.push(`Tool spec ${i}: ${e.errors.map((err) => err.message).join(', ')}`);

        // Try to fix common issues
        const fixedSpec = {
          ...(typeof spec === 'object' && spec !== null ? spec : {}),
          name: (spec as Record<string, unknown>)?.name || `tool_${i + 1}`,
          description: (spec as Record<string, unknown>)?.description || 'No description provided',
        };

        try {
          const validated = ToolSpecSchema.parse(fixedSpec);
          valid.push(validated);
          errors.pop(); // Remove the error since we fixed it
        } catch {
          // Still can't fix it, keep the error
        }
      } else {
        errors.push(`Tool spec ${i}: Unknown error`);
      }
    }
  }

  return { valid, errors };
}
