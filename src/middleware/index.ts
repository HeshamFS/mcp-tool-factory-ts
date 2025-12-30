/**
 * Request/Response validation middleware for MCP servers.
 *
 * Provides validation based on JSON Schema (from OpenAPI specs) with
 * type coercion support.
 */

/**
 * Validation error thrown when request or response validation fails.
 */
export class ValidationError extends Error {
  message: string;
  errors: Array<Record<string, unknown>>;
  fieldPath?: string;

  constructor(
    message: string,
    errors: Array<Record<string, unknown>> = [],
    fieldPath?: string
  ) {
    super(message);
    this.name = 'ValidationError';
    this.message = message;
    this.errors = errors;
    this.fieldPath = fieldPath;
  }

  /**
   * Convert to dictionary for API responses.
   */
  toDict(): Record<string, unknown> {
    return {
      error: 'Validation Error',
      message: this.message,
      details: this.errors,
      field: this.fieldPath,
    };
  }
}

/**
 * Types of validation to perform.
 */
export enum ValidationType {
  REQUEST = 'request',
  RESPONSE = 'response',
  BOTH = 'both',
}

/**
 * JSON Schema definition.
 */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  anyOf?: JsonSchema[];
  $ref?: string;
  [key: string]: unknown;
}

/**
 * Result of schema validation.
 */
export interface ValidationResult {
  isValid: boolean;
  coercedValue: unknown;
  errors: string[];
}

/**
 * JSON Schema validator with type coercion support.
 *
 * Validates values against JSON Schema definitions from OpenAPI specs.
 */
export class SchemaValidator {
  schema: JsonSchema;
  coerceTypes: boolean;

  constructor(schema: JsonSchema, coerceTypes: boolean = true) {
    this.schema = schema;
    this.coerceTypes = coerceTypes;
  }

  /**
   * Validate a value against the schema.
   */
  validate(value: unknown): ValidationResult {
    const errors: string[] = [];
    let coerced = value;

    const schemaType = this.schema.type;

    if (schemaType === 'object') {
      const result = this.validateObject(value);
      coerced = result.coerced;
      errors.push(...result.errors);
    } else if (schemaType === 'array') {
      const result = this.validateArray(value);
      coerced = result.coerced;
      errors.push(...result.errors);
    } else if (schemaType === 'string') {
      const result = this.validateString(value);
      coerced = result.coerced;
      errors.push(...result.errors);
    } else if (schemaType === 'integer') {
      const result = this.validateInteger(value);
      coerced = result.coerced;
      errors.push(...result.errors);
    } else if (schemaType === 'number') {
      const result = this.validateNumber(value);
      coerced = result.coerced;
      errors.push(...result.errors);
    } else if (schemaType === 'boolean') {
      const result = this.validateBoolean(value);
      coerced = result.coerced;
      errors.push(...result.errors);
    } else if (!schemaType && this.schema.anyOf) {
      const result = this.validateAnyOf(value);
      coerced = result.coerced;
      errors.push(...result.errors);
    }

    return {
      isValid: errors.length === 0,
      coercedValue: coerced,
      errors,
    };
  }

  private validateObject(value: unknown): { coerced: unknown; errors: string[] } {
    const errors: string[] = [];

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      if (this.coerceTypes && value === null) {
        return { coerced: {}, errors: [] };
      }
      return { coerced: value, errors: ['Expected object type'] };
    }

    const result: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    const properties = this.schema.properties ?? {};
    const required = this.schema.required ?? [];

    // Check required fields
    for (const reqField of required) {
      if (!(reqField in (value as Record<string, unknown>))) {
        errors.push(`Missing required field: ${reqField}`);
      }
    }

    // Validate each property
    for (const [propName, propSchema] of Object.entries(properties)) {
      if (propName in (value as Record<string, unknown>)) {
        const propValidator = new SchemaValidator(propSchema, this.coerceTypes);
        const validation = propValidator.validate(
          (value as Record<string, unknown>)[propName]
        );
        if (!validation.isValid) {
          errors.push(...validation.errors.map((e) => `${propName}: ${e}`));
        } else {
          result[propName] = validation.coercedValue;
        }
      }
    }

    // Check additionalProperties if specified
    if (this.schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(properties));
      const extra = Object.keys(value as Record<string, unknown>).filter(
        (k) => !allowed.has(k)
      );
      if (extra.length > 0) {
        errors.push(`Additional properties not allowed: ${extra.join(', ')}`);
      }
    }

    return { coerced: result, errors };
  }

  private validateArray(value: unknown): { coerced: unknown; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(value)) {
      if (this.coerceTypes) {
        if (value === null) {
          return { coerced: [], errors: [] };
        }
        return { coerced: [value], errors: [] };
      }
      return { coerced: value, errors: ['Expected array type'] };
    }

    const result: unknown[] = [];
    const itemsSchema = this.schema.items ?? {};
    const itemValidator = new SchemaValidator(itemsSchema, this.coerceTypes);

    for (let i = 0; i < value.length; i++) {
      const validation = itemValidator.validate(value[i]);
      if (!validation.isValid) {
        errors.push(...validation.errors.map((e) => `[${i}]: ${e}`));
      }
      result.push(validation.coercedValue);
    }

    // Check array constraints
    const minItems = this.schema.minItems;
    const maxItems = this.schema.maxItems;

    if (minItems !== undefined && result.length < minItems) {
      errors.push(`Array has ${result.length} items, minimum is ${minItems}`);
    }
    if (maxItems !== undefined && result.length > maxItems) {
      errors.push(`Array has ${result.length} items, maximum is ${maxItems}`);
    }

    return { coerced: result, errors };
  }

  private validateString(value: unknown): { coerced: unknown; errors: string[] } {
    const errors: string[] = [];
    let coerced = value;

    if (typeof value !== 'string') {
      if (this.coerceTypes && value !== null) {
        coerced = String(value);
      } else if (value === null) {
        return {
          coerced: null,
          errors: this.schema.required ? ['Value cannot be null'] : [],
        };
      } else {
        return { coerced: value, errors: ['Expected string type'] };
      }
    }

    const str = coerced as string;

    // Check string constraints
    const minLength = this.schema.minLength;
    const maxLength = this.schema.maxLength;
    const pattern = this.schema.pattern;
    const enumValues = this.schema.enum;

    if (minLength !== undefined && str.length < minLength) {
      errors.push(`String too short, minimum length is ${minLength}`);
    }
    if (maxLength !== undefined && str.length > maxLength) {
      errors.push(`String too long, maximum length is ${maxLength}`);
    }

    if (pattern) {
      if (!new RegExp(pattern).test(str)) {
        errors.push(`String does not match pattern: ${pattern}`);
      }
    }

    if (enumValues && !enumValues.includes(str)) {
      errors.push(`Value must be one of: ${enumValues.join(', ')}`);
    }

    return { coerced, errors };
  }

  private validateInteger(value: unknown): { coerced: unknown; errors: string[] } {
    const errors: string[] = [];
    let coerced = value;

    if (typeof value === 'boolean') {
      return { coerced: value, errors: ['Expected integer, got boolean'] };
    }

    if (typeof value !== 'number' || !Number.isInteger(value)) {
      if (this.coerceTypes) {
        const parsed = parseInt(String(value), 10);
        if (isNaN(parsed)) {
          return { coerced: value, errors: ['Cannot convert to integer'] };
        }
        coerced = parsed;
      } else {
        return { coerced: value, errors: ['Expected integer type'] };
      }
    }

    errors.push(...this.checkNumericConstraints(coerced as number));
    return { coerced, errors };
  }

  private validateNumber(value: unknown): { coerced: unknown; errors: string[] } {
    const errors: string[] = [];
    let coerced = value;

    if (typeof value === 'boolean') {
      return { coerced: value, errors: ['Expected number, got boolean'] };
    }

    if (typeof value !== 'number') {
      if (this.coerceTypes) {
        const parsed = parseFloat(String(value));
        if (isNaN(parsed)) {
          return { coerced: value, errors: ['Cannot convert to number'] };
        }
        coerced = parsed;
      } else {
        return { coerced: value, errors: ['Expected number type'] };
      }
    }

    // Check for NaN/Infinity
    if (!Number.isFinite(coerced as number)) {
      errors.push('Value must be finite');
    }

    errors.push(...this.checkNumericConstraints(coerced as number));
    return { coerced, errors };
  }

  private validateBoolean(value: unknown): { coerced: unknown; errors: string[] } {
    if (typeof value === 'boolean') {
      return { coerced: value, errors: [] };
    }

    if (this.coerceTypes) {
      // Common boolean coercions
      if (value === 1 || value === '1' || value === 'true' || value === 'True' || value === 'yes') {
        return { coerced: true, errors: [] };
      }
      if (value === 0 || value === '0' || value === 'false' || value === 'False' || value === 'no') {
        return { coerced: false, errors: [] };
      }
    }

    return { coerced: value, errors: ['Expected boolean type'] };
  }

  private validateAnyOf(value: unknown): { coerced: unknown; errors: string[] } {
    const anyOf = this.schema.anyOf ?? [];

    for (const subSchema of anyOf) {
      const validator = new SchemaValidator(subSchema, this.coerceTypes);
      const result = validator.validate(value);
      if (result.isValid) {
        return { coerced: result.coercedValue, errors: [] };
      }
    }

    return { coerced: value, errors: ['Value does not match any of the allowed schemas'] };
  }

  private checkNumericConstraints(value: number): string[] {
    const errors: string[] = [];

    const minimum = this.schema.minimum;
    const maximum = this.schema.maximum;
    const exclusiveMin = this.schema.exclusiveMinimum;
    const exclusiveMax = this.schema.exclusiveMaximum;
    const multipleOf = this.schema.multipleOf;

    if (minimum !== undefined && value < minimum) {
      errors.push(`Value ${value} is less than minimum ${minimum}`);
    }
    if (maximum !== undefined && value > maximum) {
      errors.push(`Value ${value} is greater than maximum ${maximum}`);
    }
    if (exclusiveMin !== undefined && value <= exclusiveMin) {
      errors.push(`Value ${value} must be greater than ${exclusiveMin}`);
    }
    if (exclusiveMax !== undefined && value >= exclusiveMax) {
      errors.push(`Value ${value} must be less than ${exclusiveMax}`);
    }
    if (multipleOf !== undefined && value % multipleOf !== 0) {
      errors.push(`Value ${value} is not a multiple of ${multipleOf}`);
    }

    return errors;
  }
}

/**
 * Validates incoming tool requests against schemas.
 */
export class RequestValidator {
  schemas: Map<string, JsonSchema> = new Map();
  coerceTypes: boolean;
  strictMode: boolean;

  constructor(coerceTypes: boolean = true, strictMode: boolean = false) {
    this.coerceTypes = coerceTypes;
    this.strictMode = strictMode;
  }

  /**
   * Register a schema for a tool.
   */
  addSchema(toolName: string, schema: JsonSchema): void {
    this.schemas.set(toolName, schema);
  }

  /**
   * Validate request arguments against schema.
   */
  validate(
    toolName: string,
    args: Record<string, unknown>
  ): { isValid: boolean; coercedArgs: Record<string, unknown>; errors: string[] } {
    const schema = this.schemas.get(toolName);

    if (!schema) {
      if (this.strictMode) {
        return {
          isValid: false,
          coercedArgs: args,
          errors: [`No schema registered for tool: ${toolName}`],
        };
      }
      return { isValid: true, coercedArgs: args, errors: [] };
    }

    const validator = new SchemaValidator(schema, this.coerceTypes);
    const result = validator.validate(args);

    return {
      isValid: result.isValid,
      coercedArgs: result.coercedValue as Record<string, unknown>,
      errors: result.errors,
    };
  }
}

/**
 * Validates tool responses against schemas.
 */
export class ResponseValidator {
  schemas: Map<string, JsonSchema> = new Map();
  logWarnings: boolean;

  constructor(logWarnings: boolean = true) {
    this.logWarnings = logWarnings;
  }

  /**
   * Register a response schema for a tool.
   */
  addSchema(toolName: string, schema: JsonSchema): void {
    this.schemas.set(toolName, schema);
  }

  /**
   * Validate response against schema.
   */
  validate(toolName: string, response: unknown): { isValid: boolean; errors: string[] } {
    const schema = this.schemas.get(toolName);

    if (!schema) {
      return { isValid: true, errors: [] };
    }

    // Don't coerce responses
    const validator = new SchemaValidator(schema, false);
    const result = validator.validate(response);

    if (!result.isValid && this.logWarnings) {
      console.warn(`Response validation failed for ${toolName}: ${result.errors.join(', ')}`);
    }

    return { isValid: result.isValid, errors: result.errors };
  }
}

/**
 * Middleware configuration.
 */
export interface ValidationMiddlewareConfig {
  validationType?: ValidationType;
  raiseOnRequestError?: boolean;
  raiseOnResponseError?: boolean;
  coerceTypes?: boolean;
  strictMode?: boolean;
  logWarnings?: boolean;
}

/**
 * Middleware that validates requests and responses.
 *
 * Can be used as a wrapper for tool functions.
 */
export class ValidationMiddleware {
  requestValidator: RequestValidator;
  responseValidator: ResponseValidator;
  validationType: ValidationType;
  raiseOnRequestError: boolean;
  raiseOnResponseError: boolean;

  constructor(config: ValidationMiddlewareConfig = {}) {
    this.requestValidator = new RequestValidator(
      config.coerceTypes ?? true,
      config.strictMode ?? false
    );
    this.responseValidator = new ResponseValidator(config.logWarnings ?? true);
    this.validationType = config.validationType ?? ValidationType.REQUEST;
    this.raiseOnRequestError = config.raiseOnRequestError ?? true;
    this.raiseOnResponseError = config.raiseOnResponseError ?? false;
  }

  /**
   * Register schemas for a tool.
   */
  registerTool(
    toolName: string,
    inputSchema?: JsonSchema,
    outputSchema?: JsonSchema
  ): void {
    if (inputSchema) {
      this.requestValidator.addSchema(toolName, inputSchema);
    }
    if (outputSchema) {
      this.responseValidator.addSchema(toolName, outputSchema);
    }
  }

  /**
   * Wrap a tool function with validation.
   */
  wrap<T extends (...args: any[]) => any>(toolName: string, fn: T): T {
    const self = this;

    return ((...args: Parameters<T>): ReturnType<T> => {
      const kwargs = args[0] as Record<string, unknown>;

      // Validate request
      if (
        self.validationType === ValidationType.REQUEST ||
        self.validationType === ValidationType.BOTH
      ) {
        const validation = self.requestValidator.validate(toolName, kwargs);
        if (!validation.isValid) {
          if (self.raiseOnRequestError) {
            throw new ValidationError(
              `Request validation failed for ${toolName}`,
              validation.errors.map((e) => ({ error: e }))
            );
          }
          console.warn(`Request validation errors for ${toolName}: ${validation.errors.join(', ')}`);
        } else {
          args[0] = validation.coercedArgs;
        }
      }

      // Call the function
      const result = fn(...args);

      // Validate response
      if (
        self.validationType === ValidationType.RESPONSE ||
        self.validationType === ValidationType.BOTH
      ) {
        const validation = self.responseValidator.validate(toolName, result);
        if (!validation.isValid && self.raiseOnResponseError) {
          throw new ValidationError(
            `Response validation failed for ${toolName}`,
            validation.errors.map((e) => ({ error: e }))
          );
        }
      }

      return result;
    }) as T;
  }

  /**
   * Create middleware from an OpenAPI specification.
   */
  static fromOpenAPI(
    openApiSpec: Record<string, unknown>,
    validationType: ValidationType = ValidationType.REQUEST
  ): ValidationMiddleware {
    const middleware = new ValidationMiddleware({ validationType });

    const paths = (openApiSpec.paths ?? {}) as Record<string, Record<string, unknown>>;
    const components = (openApiSpec.components ?? {}) as Record<string, unknown>;
    const schemas = (components.schemas ?? {}) as Record<string, JsonSchema>;

    for (const [_path, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          continue;
        }

        const op = operation as Record<string, unknown>;
        const operationId = op.operationId as string | undefined;
        if (!operationId) {
          continue;
        }

        // Extract input schema from request body
        const requestBody = (op.requestBody ?? {}) as Record<string, unknown>;
        const content = (requestBody.content ?? {}) as Record<string, unknown>;
        const jsonContent = (content['application/json'] ?? {}) as Record<string, unknown>;
        let inputSchema = jsonContent.schema as JsonSchema | undefined;

        // Resolve $ref if present
        if (inputSchema && inputSchema.$ref) {
          const ref = inputSchema.$ref;
          if (ref.startsWith('#/components/schemas/')) {
            const schemaName = ref.split('/').pop()!;
            inputSchema = schemas[schemaName];
          }
        }

        // Extract output schema from responses
        const responses = (op.responses ?? {}) as Record<string, unknown>;
        const successResponse = (responses['200'] ?? responses['201'] ?? {}) as Record<
          string,
          unknown
        >;
        const respContent = (successResponse.content ?? {}) as Record<string, unknown>;
        const respJson = (respContent['application/json'] ?? {}) as Record<string, unknown>;
        let outputSchema = respJson.schema as JsonSchema | undefined;

        // Resolve $ref for output
        if (outputSchema && outputSchema.$ref) {
          const ref = outputSchema.$ref;
          if (ref.startsWith('#/components/schemas/')) {
            const schemaName = ref.split('/').pop()!;
            outputSchema = schemas[schemaName];
          }
        }

        middleware.registerTool(operationId, inputSchema, outputSchema);
      }
    }

    return middleware;
  }
}

/**
 * Tool specification for validation code generation.
 */
export interface ToolSpecForValidation {
  name: string;
  inputSchema?: JsonSchema;
  input_schema?: JsonSchema;
}

/**
 * Generate validation middleware code for tool specs.
 */
export function generateValidationMiddlewareCode(
  toolSpecs: ToolSpecForValidation[]
): string {
  const codeParts: string[] = [
    `
// ============== REQUEST/RESPONSE VALIDATION ==============

interface ValidationErrorDetail {
  field?: string;
  error: string;
}

class ValidationError extends Error {
  message: string;
  errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.message = message;
    this.errors = errors;
  }

  toDict(): { error: string; message: string; details: ValidationErrorDetail[] } {
    return { error: 'Validation Error', message: this.message, details: this.errors };
  }
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

function validateSchema(
  value: unknown,
  schema: JsonSchema,
  coerce: boolean = true
): { isValid: boolean; coerced: unknown; errors: string[] } {
  const errors: string[] = [];
  let coerced = value;
  const schemaType = schema.type;

  if (schemaType === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return coerce ? { isValid: true, coerced: {}, errors: [] } : { isValid: false, coerced: value, errors: ['Expected object'] };
    }
    coerced = { ...(value as Record<string, unknown>) };
    for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
      if (prop in (value as Record<string, unknown>)) {
        const result = validateSchema((value as Record<string, unknown>)[prop], propSchema, coerce);
        if (!result.isValid) {
          errors.push(...result.errors.map(e => \`\${prop}: \${e}\`));
        }
        (coerced as Record<string, unknown>)[prop] = result.coerced;
      }
    }
    for (const req of schema.required ?? []) {
      if (!(req in (value as Record<string, unknown>))) {
        errors.push(\`Missing required: \${req}\`);
      }
    }
  } else if (schemaType === 'array') {
    if (!Array.isArray(value)) {
      return coerce ? { isValid: true, coerced: [], errors: [] } : { isValid: false, coerced: value, errors: ['Expected array'] };
    }
    coerced = [];
    for (let i = 0; i < value.length; i++) {
      const result = validateSchema(value[i], schema.items ?? {}, coerce);
      if (!result.isValid) {
        errors.push(...result.errors.map(e => \`[\${i}]: \${e}\`));
      }
      (coerced as unknown[]).push(result.coerced);
    }
  } else if (schemaType === 'string') {
    if (typeof value !== 'string' && coerce && value !== null) {
      coerced = String(value);
    } else if (typeof value !== 'string') {
      return { isValid: false, coerced: value, errors: ['Expected string'] };
    }
    const str = coerced as string;
    if (schema.minLength !== undefined && str.length < schema.minLength) {
      errors.push(\`String too short (min \${schema.minLength})\`);
    }
    if (schema.maxLength !== undefined && str.length > schema.maxLength) {
      errors.push(\`String too long (max \${schema.maxLength})\`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(str)) {
      errors.push('Does not match pattern');
    }
    if (schema.enum && !schema.enum.includes(str)) {
      errors.push(\`Must be one of \${schema.enum.join(', ')}\`);
    }
  } else if (schemaType === 'integer') {
    if (typeof value === 'boolean') {
      return { isValid: false, coerced: value, errors: ['Expected integer, got boolean'] };
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      if (coerce) {
        const parsed = parseInt(String(value), 10);
        if (isNaN(parsed)) return { isValid: false, coerced: value, errors: ['Cannot convert to integer'] };
        coerced = parsed;
      } else {
        return { isValid: false, coerced: value, errors: ['Expected integer'] };
      }
    }
    if (schema.minimum !== undefined && (coerced as number) < schema.minimum) {
      errors.push(\`Value below minimum \${schema.minimum}\`);
    }
    if (schema.maximum !== undefined && (coerced as number) > schema.maximum) {
      errors.push(\`Value above maximum \${schema.maximum}\`);
    }
  } else if (schemaType === 'number') {
    if (typeof value === 'boolean') {
      return { isValid: false, coerced: value, errors: ['Expected number, got boolean'] };
    }
    if (typeof value !== 'number') {
      if (coerce) {
        const parsed = parseFloat(String(value));
        if (isNaN(parsed)) return { isValid: false, coerced: value, errors: ['Cannot convert to number'] };
        coerced = parsed;
      } else {
        return { isValid: false, coerced: value, errors: ['Expected number'] };
      }
    }
    if (!Number.isFinite(coerced as number)) {
      errors.push('Value must be finite');
    }
    if (schema.minimum !== undefined && (coerced as number) < schema.minimum) {
      errors.push(\`Value below minimum \${schema.minimum}\`);
    }
    if (schema.maximum !== undefined && (coerced as number) > schema.maximum) {
      errors.push(\`Value above maximum \${schema.maximum}\`);
    }
  } else if (schemaType === 'boolean') {
    if (typeof value !== 'boolean') {
      if (coerce) {
        if (value === 1 || value === '1' || value === 'true' || value === 'yes') {
          coerced = true;
        } else if (value === 0 || value === '0' || value === 'false' || value === 'no') {
          coerced = false;
        } else {
          return { isValid: false, coerced: value, errors: ['Expected boolean'] };
        }
      } else {
        return { isValid: false, coerced: value, errors: ['Expected boolean'] };
      }
    }
  }

  return { isValid: errors.length === 0, coerced, errors };
}

// Tool input schemas for validation
const TOOL_SCHEMAS: Record<string, JsonSchema> = {
`,
  ];

  // Add schemas for each tool
  for (const tool of toolSpecs) {
    const toolName = tool.name ?? 'unknown';
    const inputSchema = tool.inputSchema ?? tool.input_schema ?? {};
    codeParts.push(`  "${toolName}": ${JSON.stringify(inputSchema)},`);
  }

  codeParts.push(`};

function validateToolInput(
  toolName: string,
  args: Record<string, unknown>
): Record<string, unknown> {
  const schema = TOOL_SCHEMAS[toolName];
  if (!schema) {
    return args;
  }

  const result = validateSchema(args, schema);
  if (!result.isValid) {
    throw new ValidationError(
      \`Invalid input for \${toolName}\`,
      result.errors.map(e => ({
        field: e.includes(':') ? e.split(':')[0] : undefined,
        error: e
      }))
    );
  }

  return result.coerced as Record<string, unknown>;
}

function withValidation<T extends (args: Record<string, unknown>) => unknown>(
  toolName: string,
  fn: T
): T {
  return ((args: Record<string, unknown>) => {
    const validated = validateToolInput(toolName, args);
    return fn(validated);
  }) as T;
}

`);

  return codeParts.join('\n');
}
