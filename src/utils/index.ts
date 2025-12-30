/**
 * Utilities module for MCP Tool Factory.
 *
 * Provides input validation, dependency management, and common utilities.
 */

// Input validation - core types and functions
export {
  // Validation result types
  type ValidationResult,
  validationSuccess,
  validationFailure,
  // Core validation functions
  validateFinite,
  validateString,
  validateInteger,
  validateNumber,
  validateUrl,
  validateEmail,
  validatePath,
  // Validation options interfaces
  type ValidateStringOptions,
  type ValidateIntegerOptions,
  type ValidateNumberOptions,
  type ValidateUrlOptions,
  type ValidatePathOptions,
  // Fluent validator
  InputValidator,
  // Sanitization
  sanitizeString,
  sanitizeFilename,
  escapeHtml,
  // Code generation
  generateValidationUtilitiesCode,
  // Legacy/utility exports
  ValidationPatterns,
  CommonSchemas,
  validateUrlLegacy,
  validateEmailLegacy,
  isSafeInteger,
  truncateString,
  validateJsonSchemaType,
  createRateLimiter,
} from './input-validation.js';

// Dependencies
export {
  type PackageVersion,
  type DependencyCategory,
  KNOWN_VERSIONS,
  CORE_DEPENDENCIES,
  CORE_DEV_DEPENDENCIES,
  getLatestVersion,
  getKnownVersion,
  mergeDependencies,
  categorizeDependencies,
  generatePackageDependencies,
  isValidPackageName,
} from './dependencies.js';
