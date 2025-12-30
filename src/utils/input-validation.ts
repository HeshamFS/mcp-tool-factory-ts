/**
 * Standardized input validation utilities for MCP servers.
 *
 * Provides consistent validation patterns for common input types
 * to be used in generated MCP servers.
 */

import { z } from 'zod';

/**
 * Result of a validation operation.
 */
export interface ValidationResult<T = unknown> {
  isValid: boolean;
  value: T;
  error: string | null;
}

/**
 * Create a successful validation result.
 */
export function validationSuccess<T>(value: T): ValidationResult<T> {
  return { isValid: true, value, error: null };
}

/**
 * Create a failed validation result.
 */
export function validationFailure<T>(error: string, value: T): ValidationResult<T> {
  return { isValid: false, value, error };
}

/**
 * Validate that a number is finite (not NaN or infinity).
 */
export function validateFinite(value: number, name: string = 'value'): ValidationResult<number> {
  if (typeof value !== 'number') {
    return validationFailure(`${name} must be a number`, value);
  }

  if (Number.isNaN(value)) {
    return validationFailure(`${name} cannot be NaN`, value);
  }

  if (!Number.isFinite(value)) {
    return validationFailure(`${name} cannot be infinity`, value);
  }

  return validationSuccess(value);
}

/**
 * Options for string validation.
 */
export interface ValidateStringOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp | string;
  allowedValues?: string[];
  strip?: boolean;
}

/**
 * Validate a string value with optional constraints.
 */
export function validateString(
  value: unknown,
  name: string = 'value',
  options: ValidateStringOptions = {}
): ValidationResult<string> {
  const { minLength, maxLength, pattern, allowedValues, strip = true } = options;

  if (value === null || value === undefined) {
    return validationFailure(`${name} cannot be null`, String(value));
  }

  let strValue: string;
  if (typeof value !== 'string') {
    try {
      strValue = String(value);
    } catch {
      return validationFailure(`${name} must be a string`, String(value));
    }
  } else {
    strValue = value;
  }

  if (strip) {
    strValue = strValue.trim();
  }

  if (minLength !== undefined && strValue.length < minLength) {
    return validationFailure(`${name} must be at least ${minLength} characters`, strValue);
  }

  if (maxLength !== undefined && strValue.length > maxLength) {
    return validationFailure(`${name} must be at most ${maxLength} characters`, strValue);
  }

  if (pattern !== undefined) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    if (!regex.test(strValue)) {
      return validationFailure(`${name} does not match required pattern`, strValue);
    }
  }

  if (allowedValues !== undefined && !allowedValues.includes(strValue)) {
    return validationFailure(`${name} must be one of: ${allowedValues.join(', ')}`, strValue);
  }

  return validationSuccess(strValue);
}

/**
 * Options for integer validation.
 */
export interface ValidateIntegerOptions {
  minimum?: number;
  maximum?: number;
  coerce?: boolean;
}

/**
 * Validate an integer value with optional constraints.
 */
export function validateInteger(
  value: unknown,
  name: string = 'value',
  options: ValidateIntegerOptions = {}
): ValidationResult<number> {
  const { minimum, maximum, coerce = true } = options;

  // Booleans are not valid integers
  if (typeof value === 'boolean') {
    return validationFailure(`${name} must be an integer, not boolean`, Number(value));
  }

  let intValue: number;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    if (coerce) {
      try {
        intValue = parseInt(String(value), 10);
        if (Number.isNaN(intValue)) {
          return validationFailure(`${name} must be an integer`, Number(value));
        }
      } catch {
        return validationFailure(`${name} must be an integer`, Number(value));
      }
    } else {
      return validationFailure(`${name} must be an integer`, Number(value));
    }
  } else {
    intValue = value;
  }

  if (minimum !== undefined && intValue < minimum) {
    return validationFailure(`${name} must be at least ${minimum}`, intValue);
  }

  if (maximum !== undefined && intValue > maximum) {
    return validationFailure(`${name} must be at most ${maximum}`, intValue);
  }

  return validationSuccess(intValue);
}

/**
 * Options for number validation.
 */
export interface ValidateNumberOptions {
  minimum?: number;
  maximum?: number;
  allowInfinity?: boolean;
  allowNaN?: boolean;
  coerce?: boolean;
}

/**
 * Validate a numeric value with optional constraints.
 */
export function validateNumber(
  value: unknown,
  name: string = 'value',
  options: ValidateNumberOptions = {}
): ValidationResult<number> {
  const { minimum, maximum, allowInfinity = false, allowNaN = false, coerce = true } = options;

  // Booleans are not valid numbers
  if (typeof value === 'boolean') {
    return validationFailure(`${name} must be a number, not boolean`, Number(value));
  }

  let numValue: number;
  if (typeof value !== 'number') {
    if (coerce) {
      try {
        numValue = parseFloat(String(value));
        if (Number.isNaN(numValue) && !allowNaN) {
          return validationFailure(`${name} must be a number`, numValue);
        }
      } catch {
        return validationFailure(`${name} must be a number`, Number(value));
      }
    } else {
      return validationFailure(`${name} must be a number`, Number(value));
    }
  } else {
    numValue = value;
  }

  if (!allowNaN && Number.isNaN(numValue)) {
    return validationFailure(`${name} cannot be NaN`, numValue);
  }

  if (!allowInfinity && !Number.isFinite(numValue) && !Number.isNaN(numValue)) {
    return validationFailure(`${name} cannot be infinity`, numValue);
  }

  if (minimum !== undefined && numValue < minimum) {
    return validationFailure(`${name} must be at least ${minimum}`, numValue);
  }

  if (maximum !== undefined && numValue > maximum) {
    return validationFailure(`${name} must be at most ${maximum}`, numValue);
  }

  return validationSuccess(numValue);
}

/**
 * Options for URL validation.
 */
export interface ValidateUrlOptions {
  allowedSchemes?: string[];
  requireTld?: boolean;
}

/**
 * Validate a URL string.
 */
export function validateUrl(
  value: unknown,
  name: string = 'url',
  options: ValidateUrlOptions = {}
): ValidationResult<string> {
  const { allowedSchemes = ['http', 'https'], requireTld = true } = options;

  const strResult = validateString(value, name);
  if (!strResult.isValid) {
    return strResult;
  }

  const urlStr = strResult.value;

  try {
    const parsed = new URL(urlStr);

    const scheme = parsed.protocol.replace(':', '');
    if (!allowedSchemes.includes(scheme)) {
      return validationFailure(
        `${name} scheme must be one of: ${allowedSchemes.join(', ')}`,
        urlStr
      );
    }

    if (!parsed.hostname) {
      return validationFailure(`${name} must have a host`, urlStr);
    }

    // Extract host without port for TLD check
    const host = parsed.hostname;
    if (requireTld && !host.includes('.') && host !== 'localhost') {
      return validationFailure(`${name} must have a valid domain`, urlStr);
    }

    return validationSuccess(urlStr);
  } catch {
    return validationFailure(`${name} is not a valid URL`, urlStr);
  }
}

/**
 * Validate an email address.
 */
export function validateEmail(
  value: unknown,
  name: string = 'email'
): ValidationResult<string> {
  const strResult = validateString(value, name, { minLength: 3, maxLength: 254 });
  if (!strResult.isValid) {
    return strResult;
  }

  const email = strResult.value;

  // Basic email pattern - not RFC 5322 compliant but catches most issues
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(email)) {
    return validationFailure(`${name} is not a valid email address`, email);
  }

  return validationSuccess(email);
}

/**
 * Options for path validation.
 */
export interface ValidatePathOptions {
  mustBeAbsolute?: boolean;
  allowedExtensions?: string[];
  disallowTraversal?: boolean;
}

/**
 * Validate a file path string.
 */
export function validatePath(
  value: unknown,
  name: string = 'path',
  options: ValidatePathOptions = {}
): ValidationResult<string> {
  const { mustBeAbsolute = false, allowedExtensions, disallowTraversal = true } = options;

  const strResult = validateString(value, name, { minLength: 1 });
  if (!strResult.isValid) {
    return strResult;
  }

  const pathStr = strResult.value;

  // Check for path traversal attempts
  if (disallowTraversal && pathStr.includes('..')) {
    return validationFailure(`${name} cannot contain path traversal (..)`, pathStr);
  }

  // Check absolute path requirement
  if (mustBeAbsolute) {
    // Works for both Unix and Windows
    const isAbsolute = pathStr.startsWith('/') || (pathStr.length > 1 && pathStr[1] === ':');
    if (!isAbsolute) {
      return validationFailure(`${name} must be an absolute path`, pathStr);
    }
  }

  // Check file extension
  if (allowedExtensions !== undefined) {
    const ext = pathStr.includes('.') ? pathStr.split('.').pop()?.toLowerCase() ?? '' : '';
    const allowedLower = allowedExtensions.map((e) => e.toLowerCase().replace(/^\./, ''));
    if (!allowedLower.includes(ext)) {
      return validationFailure(
        `${name} must have extension: ${allowedExtensions.join(', ')}`,
        pathStr
      );
    }
  }

  return validationSuccess(pathStr);
}

/**
 * Sanitize a string by removing potentially dangerous characters.
 */
export function sanitizeString(
  value: string,
  options: { allowHtml?: boolean; maxLength?: number } = {}
): string {
  const { allowHtml = false, maxLength } = options;

  if (typeof value !== 'string') {
    value = String(value);
  }

  // Strip whitespace
  value = value.trim();

  // Remove null bytes
  value = value.replace(/\x00/g, '');

  // Escape HTML if not allowed
  if (!allowHtml) {
    value = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  // Truncate if needed
  if (maxLength !== undefined && value.length > maxLength) {
    value = value.slice(0, maxLength);
  }

  return value;
}

/**
 * Fluent interface for input validation.
 *
 * @example
 * ```typescript
 * const validator = new InputValidator();
 * const result = validator
 *   .field('age', userInput)
 *   .required()
 *   .integer({ minimum: 0, maximum: 150 })
 *   .validate();
 * ```
 */
export class InputValidator {
  private _fieldName: string = 'value';
  private _value: unknown = null;
  private _errors: string[] = [];
  private _validatedValue: unknown = null;

  /**
   * Start validation for a field.
   */
  field(name: string, value: unknown): this {
    this._fieldName = name;
    this._value = value;
    this._validatedValue = value;
    this._errors = [];
    return this;
  }

  /**
   * Validate that the field is not null or empty.
   */
  required(): this {
    if (this._value === null || this._value === undefined || this._value === '') {
      this._errors.push(`${this._fieldName} is required`);
    }
    return this;
  }

  /**
   * Mark field as optional with default value.
   */
  optional<T>(defaultValue: T): this {
    if (this._value === null || this._value === undefined || this._value === '') {
      this._validatedValue = defaultValue;
    }
    return this;
  }

  /**
   * Validate as string.
   */
  string(options?: ValidateStringOptions): this {
    if (this._errors.length > 0 || this._value === null || this._value === undefined) {
      return this;
    }

    const result = validateString(this._value, this._fieldName, options);
    if (!result.isValid && result.error) {
      this._errors.push(result.error);
    } else {
      this._validatedValue = result.value;
    }
    return this;
  }

  /**
   * Validate as integer.
   */
  integer(options?: ValidateIntegerOptions): this {
    if (this._errors.length > 0 || this._value === null || this._value === undefined) {
      return this;
    }

    const result = validateInteger(this._value, this._fieldName, options);
    if (!result.isValid && result.error) {
      this._errors.push(result.error);
    } else {
      this._validatedValue = result.value;
    }
    return this;
  }

  /**
   * Validate as number.
   */
  number(options?: ValidateNumberOptions): this {
    if (this._errors.length > 0 || this._value === null || this._value === undefined) {
      return this;
    }

    const result = validateNumber(this._value, this._fieldName, options);
    if (!result.isValid && result.error) {
      this._errors.push(result.error);
    } else {
      this._validatedValue = result.value;
    }
    return this;
  }

  /**
   * Validate as URL.
   */
  url(options?: ValidateUrlOptions): this {
    if (this._errors.length > 0 || this._value === null || this._value === undefined) {
      return this;
    }

    const result = validateUrl(this._value, this._fieldName, options);
    if (!result.isValid && result.error) {
      this._errors.push(result.error);
    } else {
      this._validatedValue = result.value;
    }
    return this;
  }

  /**
   * Validate as email.
   */
  email(): this {
    if (this._errors.length > 0 || this._value === null || this._value === undefined) {
      return this;
    }

    const result = validateEmail(this._value, this._fieldName);
    if (!result.isValid && result.error) {
      this._errors.push(result.error);
    } else {
      this._validatedValue = result.value;
    }
    return this;
  }

  /**
   * Validate as file path.
   */
  path(options?: ValidatePathOptions): this {
    if (this._errors.length > 0 || this._value === null || this._value === undefined) {
      return this;
    }

    const result = validatePath(this._value, this._fieldName, options);
    if (!result.isValid && result.error) {
      this._errors.push(result.error);
    } else {
      this._validatedValue = result.value;
    }
    return this;
  }

  /**
   * Complete validation and return result.
   */
  validate<T = unknown>(): ValidationResult<T> {
    if (this._errors.length > 0) {
      return validationFailure(this._errors.join('; '), this._value as T);
    }
    return validationSuccess(this._validatedValue as T);
  }
}

/**
 * Generate validation utilities code for inclusion in generated servers.
 */
export function generateValidationUtilitiesCode(): string {
  return `
// ============== INPUT VALIDATION UTILITIES ==============

interface ValidationResult<T = unknown> {
  isValid: boolean;
  value: T;
  error: string | null;
}

function validationOk<T>(value: T): ValidationResult<T> {
  return { isValid: true, value, error: null };
}

function validationErr<T>(error: string, value: T): ValidationResult<T> {
  return { isValid: false, value, error };
}

function validateFinite(value: number, name: string = 'value'): ValidationResult<number> {
  if (typeof value !== 'number') {
    return validationErr(\`\${name} must be a number\`, value);
  }
  if (Number.isNaN(value)) {
    return validationErr(\`\${name} cannot be NaN\`, value);
  }
  if (!Number.isFinite(value)) {
    return validationErr(\`\${name} cannot be infinity\`, value);
  }
  return validationOk(value);
}

function validateString(
  value: unknown,
  name: string = 'value',
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {}
): ValidationResult<string> {
  if (value === null || value === undefined) {
    return validationErr(\`\${name} cannot be null\`, String(value));
  }
  let strValue = typeof value === 'string' ? value : String(value);
  strValue = strValue.trim();
  if (options.minLength !== undefined && strValue.length < options.minLength) {
    return validationErr(\`\${name} must be at least \${options.minLength} characters\`, strValue);
  }
  if (options.maxLength !== undefined && strValue.length > options.maxLength) {
    return validationErr(\`\${name} must be at most \${options.maxLength} characters\`, strValue);
  }
  if (options.pattern !== undefined && !options.pattern.test(strValue)) {
    return validationErr(\`\${name} does not match required pattern\`, strValue);
  }
  return validationOk(strValue);
}

function validateInteger(
  value: unknown,
  name: string = 'value',
  options: { minimum?: number; maximum?: number } = {}
): ValidationResult<number> {
  if (typeof value === 'boolean') {
    return validationErr(\`\${name} must be an integer\`, Number(value));
  }
  let intValue: number;
  if (typeof value === 'number' && Number.isInteger(value)) {
    intValue = value;
  } else {
    intValue = parseInt(String(value), 10);
    if (Number.isNaN(intValue)) {
      return validationErr(\`\${name} must be an integer\`, intValue);
    }
  }
  if (options.minimum !== undefined && intValue < options.minimum) {
    return validationErr(\`\${name} must be at least \${options.minimum}\`, intValue);
  }
  if (options.maximum !== undefined && intValue > options.maximum) {
    return validationErr(\`\${name} must be at most \${options.maximum}\`, intValue);
  }
  return validationOk(intValue);
}

function validateNumber(
  value: unknown,
  name: string = 'value',
  options: { minimum?: number; maximum?: number } = {}
): ValidationResult<number> {
  if (typeof value === 'boolean') {
    return validationErr(\`\${name} must be a number\`, Number(value));
  }
  let numValue: number;
  if (typeof value === 'number') {
    numValue = value;
  } else {
    numValue = parseFloat(String(value));
    if (Number.isNaN(numValue)) {
      return validationErr(\`\${name} must be a number\`, numValue);
    }
  }
  if (Number.isNaN(numValue)) {
    return validationErr(\`\${name} cannot be NaN\`, numValue);
  }
  if (!Number.isFinite(numValue)) {
    return validationErr(\`\${name} cannot be infinity\`, numValue);
  }
  if (options.minimum !== undefined && numValue < options.minimum) {
    return validationErr(\`\${name} must be at least \${options.minimum}\`, numValue);
  }
  if (options.maximum !== undefined && numValue > options.maximum) {
    return validationErr(\`\${name} must be at most \${options.maximum}\`, numValue);
  }
  return validationOk(numValue);
}

function validateUrl(value: unknown, name: string = 'url'): ValidationResult<string> {
  const strResult = validateString(value, name);
  if (!strResult.isValid) return strResult;
  const urlStr = strResult.value;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return validationErr(\`\${name} must use http or https\`, urlStr);
    }
    if (!parsed.hostname) {
      return validationErr(\`\${name} must have a host\`, urlStr);
    }
  } catch {
    return validationErr(\`\${name} is not a valid URL\`, urlStr);
  }
  return validationOk(urlStr);
}

function validateEmail(value: unknown, name: string = 'email'): ValidationResult<string> {
  const strResult = validateString(value, name, { minLength: 3, maxLength: 254 });
  if (!strResult.isValid) return strResult;
  const email = strResult.value;
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
  if (!pattern.test(email)) {
    return validationErr(\`\${name} is not a valid email\`, email);
  }
  return validationOk(email);
}

function sanitizeString(value: string, maxLength?: number): string {
  if (typeof value !== 'string') value = String(value);
  value = value.trim().replace(/\\x00/g, '');
  value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  value = value.replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  if (maxLength && value.length > maxLength) value = value.slice(0, maxLength);
  return value;
}

`;
}

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility with existing code)
// =============================================================================

/**
 * Common validation patterns.
 */
export const ValidationPatterns = {
  // Email pattern
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // URL pattern
  url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,

  // UUID v4 pattern
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,

  // ISO date pattern (YYYY-MM-DD)
  isoDate: /^\d{4}-\d{2}-\d{2}$/,

  // ISO datetime pattern
  isoDateTime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,

  // Slug pattern
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,

  // Safe filename pattern
  safeFilename: /^[a-zA-Z0-9._-]+$/,

  // Phone number pattern (E.164)
  phone: /^\+[1-9]\d{1,14}$/,

  // Credit card number pattern (basic)
  creditCard: /^\d{13,19}$/,

  // IP address v4 pattern
  ipv4: /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/,

  // IP address v6 pattern (simplified)
  ipv6: /^(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}$/,
};

/**
 * Zod schemas for common types.
 */
export const CommonSchemas = {
  email: z.string().email('Invalid email address'),

  url: z.string().url('Invalid URL'),

  uuid: z.string().uuid('Invalid UUID'),

  positiveInt: z.number().int().positive('Must be a positive integer'),

  nonNegativeInt: z.number().int().nonnegative('Must be a non-negative integer'),

  safeString: z
    .string()
    .max(1000)
    .regex(/^[^<>]*$/, 'String contains potentially unsafe characters'),

  noSqlInjection: z
    .string()
    .regex(/^[^'";\-\-]*$/, 'String contains potentially unsafe SQL characters'),

  jsonString: z.string().transform((val, ctx) => {
    try {
      return JSON.parse(val);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid JSON string',
      });
      return z.NEVER;
    }
  }),

  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  }),
};

/**
 * Sanitize a string for use in file paths.
 */
export function sanitizeFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '')
    .slice(0, 255);
}

/**
 * Validate and sanitize URL (legacy wrapper).
 */
export function validateUrlLegacy(input: string): string | null {
  const result = validateUrl(input);
  return result.isValid ? result.value : null;
}

/**
 * Validate and normalize email address (legacy wrapper).
 */
export function validateEmailLegacy(input: string): string | null {
  const result = validateEmail(input.toLowerCase().trim());
  return result.isValid ? result.value : null;
}

/**
 * Escape HTML entities to prevent XSS.
 */
export function escapeHtml(input: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return input.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char);
}

/**
 * Check if a value is a safe integer.
 */
export function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/**
 * Truncate a string to a maximum length.
 */
export function truncateString(
  input: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (input.length <= maxLength) {
    return input;
  }
  return input.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Validate a JSON Schema type.
 */
export function validateJsonSchemaType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
    case 'integer':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return false;
  }
}

/**
 * Create a rate limiter function.
 */
export function createRateLimiter(
  maxRequests: number,
  windowMs: number
): () => boolean {
  const timestamps: number[] = [];

  return (): boolean => {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old timestamps
    while (timestamps.length > 0 && timestamps[0]! < windowStart) {
      timestamps.shift();
    }

    // Check if under limit
    if (timestamps.length < maxRequests) {
      timestamps.push(now);
      return true;
    }

    return false;
  };
}
