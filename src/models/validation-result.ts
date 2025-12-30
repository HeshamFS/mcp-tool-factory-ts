/**
 * Result of validating a tool specification.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Create a successful validation result.
 */
export function createValidResult(): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };
}

/**
 * Create a failed validation result.
 */
export function createInvalidResult(errors: string[]): ValidationResult {
  return {
    valid: false,
    errors,
    warnings: [],
    suggestions: [],
  };
}
