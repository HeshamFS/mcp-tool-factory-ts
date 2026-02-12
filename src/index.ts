/**
 * MCP Tool Factory - TypeScript Edition
 *
 * Generate production-ready MCP servers from natural language descriptions,
 * OpenAPI specs, or database schemas.
 *
 * @packageDocumentation
 */

// Re-export all public APIs

// Agent
export { ToolFactoryAgent, BudgetExceededError, type GenerateOptions } from './agent/index.js';

// Models
export {
  type ToolSpec,
  type JsonSchema,
  type JsonSchemaProperty,
  createToolSpec,
  toolSpecToDict,
  type GeneratedServer,
  createGeneratedServer,
  writeServerToDirectory,
  type WebSearchEntry,
  type GenerationStep,
  type GenerationLog,
  createGenerationLog,
  generationLogToMarkdown,
  type ValidationResult,
  createValidResult,
  createInvalidResult,
  InputType,
  type ResourceSpec,
  createResourceSpec,
  type PromptSpec,
  type PromptArgument,
  createPromptSpec,
} from './models/index.js';

// Config
export {
  type FactoryConfig,
  LLMProvider,
  getDefaultConfig,
  validateConfig,
  CLAUDE_MODELS,
  OPENAI_MODELS,
  GOOGLE_MODELS,
  MISTRAL_MODELS,
  DEEPSEEK_MODELS,
  GROQ_MODELS,
  XAI_MODELS,
  COHERE_MODELS,
  DEFAULT_MODELS,
  API_KEY_ENV_VARS,
  type ModelPricing,
  type TokenDetails,
  type CostBreakdown,
  MODEL_PRICING,
  calculateCost,
  formatCost,
  estimateCost,
} from './config/index.js';

// Providers
export {
  type LLMProviderInterface,
  BaseCachingProvider,
  BaseLLMProvider,
  type LLMResponse,
  createProvider,
  UnifiedLLMProvider,
  ClaudeCodeProvider,
} from './providers/index.js';

// Generators
export {
  ServerGenerator,
  DocsGenerator,
  TestsGenerator,
  type ProductionConfig,
  type TestGeneratorConfig,
  type GeneratedTestCase,
} from './generators/index.js';

// Validation
export {
  ToolSpecSchema,
  validateToolSpecs,
  parseToolResponse,
  extractJsonFromResponse,
  validateTypeScriptCode,
  validateGeneratedServer,
  // Registry validation
  validateMcpName,
  validateVersion,
  validateServerJson,
  validateGeneratedServerForRegistry,
  ServerJsonSchema,
  EnvironmentVariableSchema,
  PackageSchema,
  type ServerJson,
  type EnvironmentVariable,
  type Package,
  type RegistryValidationResult,
} from './validation/index.js';

// OpenAPI
export {
  OpenAPIServerGenerator,
  AuthType,
  type AuthConfig,
  type EndpointSpec,
} from './openapi/index.js';

// Database
export {
  DatabaseServerGenerator,
  DatabaseIntrospector,
  DatabaseType,
  type ColumnInfo,
  type TableInfo,
  columnToTypeScriptType,
  columnToJsonSchemaType,
  getPrimaryKey,
  getNonPkColumns,
} from './database/index.js';

// GraphQL
export { GraphQLServerGenerator } from './graphql/index.js';

// Ontology
export {
  OntologyParser,
  OntologyServerGenerator,
  type OntologyDefinition,
  type OntologyClass,
  type OntologyProperty,
  type OntologyIndividual,
} from './ontology/index.js';

// Auth
export {
  OAuth2Flow,
  type OAuth2Token,
  type OAuth2Config,
  createOAuth2Token,
  createOAuth2Config,
  isTokenExpired,
  getAuthorizationUrl,
  type PKCECodeVerifier,
  generatePKCE,
  type OAuth2Provider,
  GitHubOAuth2Provider,
  GoogleOAuth2Provider,
  AzureADOAuth2Provider,
  getOAuth2Provider,
  OAUTH2_PROVIDERS,
} from './auth/index.js';

// Utilities
export {
  ValidationPatterns,
  CommonSchemas,
  sanitizeString,
  sanitizeFilename,
  validateUrl,
  validateEmail,
  escapeHtml,
  createRateLimiter,
  KNOWN_VERSIONS,
  CORE_DEPENDENCIES,
  getKnownVersion,
  generatePackageDependencies,
} from './utils/index.js';

// Execution Logger
export {
  ExecutionLogger,
  createExecutionLogger,
  type RawLLMCall,
  type RawHTTPRequest,
  type RawWebSearch,
  type RawToolExecution,
  type ExecutionStep,
} from './execution-logger/index.js';

// Web Search
export {
  WebSearcher,
  type SearchResult,
  createSearchResult,
  searchForApiInfo,
  searchForApiInfoWithLogging,
} from './web-search/index.js';

// Production
export {
  LogLevel,
  RateLimitBackend,
  type ProductionConfig as ProductionFeatureConfig,
  createProductionConfig,
  ProductionCodeGenerator,
  generateProductionServerAdditions,
} from './production/index.js';

// Security
export {
  IssueSeverity,
  type SecurityIssue,
  type ScanRule,
  type ScanSummary,
  SecurityScanner,
  DEFAULT_RULES,
  scanCode,
  scanFile,
  generateSecurityReport,
} from './security/index.js';

// Middleware
export {
  ValidationError,
  ValidationType,
  type JsonSchema as MiddlewareJsonSchema,
  SchemaValidator,
  RequestValidator,
  ResponseValidator,
  ValidationMiddleware,
  generateValidationMiddlewareCode,
} from './middleware/index.js';

// Observability
export {
  TelemetryExporter,
  type TelemetryConfig,
  createTelemetryConfig,
  TelemetryCodeGenerator,
  generateTelemetryCode,
} from './observability/index.js';

// Cache
export {
  LLMCache,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
  type CacheKeyParams,
  DEFAULT_CACHE_CONFIG,
  createCacheConfig,
  getGlobalCache,
  resetGlobalCache,
} from './cache/index.js';

// Version
export const VERSION = '0.3.0';
