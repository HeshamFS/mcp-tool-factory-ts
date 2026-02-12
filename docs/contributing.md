# Contributing

Guide for contributing to MCP Tool Factory.

## Overview

| Topic | Description |
|-------|-------------|
| [Development Setup](#development-setup) | Get the project running locally |
| [Code Structure](#code-structure) | Understanding the codebase |
| [Coding Standards](#coding-standards) | Style and conventions |
| [Testing](#testing) | Running and writing tests |
| [Pull Requests](#pull-requests) | Submitting changes |

---

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Git
- API key for testing (Anthropic, OpenAI, or Google)

### Clone and Install

```bash
# Clone repository
git clone https://github.com/HeshamFS/mcp-tool-factory-ts.git
cd mcp-tool-factory-ts

# Install dependencies
pnpm install
```

### Configure API Keys

```bash
# For testing LLM features
export ANTHROPIC_API_KEY=sk-ant-api03-...

# Or alternative providers
export OPENAI_API_KEY=sk-...
export GOOGLE_API_KEY=AIza...
```

### Verify Setup

```bash
# Build
pnpm run build

# Type check
pnpm run typecheck

# Lint
pnpm run lint

# Test
pnpm test
```

---

## Code Structure

```
mcp-tool-factory-ts/
├── src/
│   ├── agent/           # Main ToolFactoryAgent
│   │   ├── agent.ts     # Core generation logic
│   │   └── index.ts     # Exports
│   │
│   ├── providers/       # LLM Providers (Vercel AI SDK v0.3.0)
│   │   ├── base.ts      # Abstract provider with caching + LLMResponse
│   │   ├── llm-provider.ts # UnifiedLLMProvider (10 AI SDK providers)
│   │   ├── claude-code.ts # Claude Code OAuth integration
│   │   └── factory.ts   # Provider auto-detection factory
│   │
│   ├── generators/      # Code Generators
│   │   ├── server.ts    # Server code generator (tools + resources + prompts)
│   │   ├── docs.ts      # Documentation generator (README, skill, changelog, API docs)
│   │   └── tests.ts     # Test generator
│   │
│   ├── templates/       # Handlebars Templates
│   │   ├── server.ts.hbs      # Server template
│   │   ├── package.json.hbs
│   │   ├── server.json.hbs
│   │   └── ...
│   │
│   ├── openapi/         # OpenAPI Parser
│   │   ├── generator.ts # OpenAPI spec → MCP tools
│   │   └── index.ts
│   │
│   ├── database/        # Database Introspection
│   │   ├── generator.ts # DB schema → CRUD tools
│   │   ├── introspector.ts
│   │   └── index.ts
│   │
│   ├── graphql/         # GraphQL SDL Parser (v0.2.0)
│   │   ├── generator.ts # GraphQL SDL → MCP tools
│   │   └── index.ts
│   │
│   ├── ontology/        # Ontology Parser (v0.2.0)
│   │   ├── types.ts     # OntologyDefinition types
│   │   ├── parser.ts    # Multi-format parser (RDF/OWL, JSON-LD, YAML)
│   │   ├── generator.ts # Ontology → CRUD + relationship tools
│   │   └── index.ts
│   │
│   ├── cache/           # LLM Response Cache (v0.2.0)
│   │   └── index.ts     # LLMCache with TTL and statistics
│   │
│   ├── models/          # Data Models
│   │   ├── tool-spec.ts
│   │   ├── resource-spec.ts   # ResourceSpec (v0.2.0)
│   │   ├── prompt-spec.ts     # PromptSpec (v0.2.0)
│   │   ├── generated-server.ts
│   │   ├── generation-log.ts
│   │   └── index.ts
│   │
│   ├── validation/      # Code Validation
│   │   ├── parser.ts    # Response parsing
│   │   ├── schemas.ts   # Zod schemas
│   │   ├── registry.ts  # Validation registry
│   │   └── index.ts
│   │
│   ├── prompts/         # LLM Prompts
│   │   └── prompts.ts   # Extraction prompts (tools, resources, prompts)
│   │
│   ├── config/          # Configuration
│   ├── cli/             # CLI Interface
│   ├── server/          # MCP Server Mode (factory-as-server)
│   ├── auth/            # OAuth2 Support
│   ├── web-search/      # Web Search Integration
│   ├── production/      # Production Code Generation
│   ├── security/        # Security Scanning
│   ├── middleware/       # Validation Middleware
│   ├── observability/   # Telemetry/Tracing
│   ├── execution-logger/ # Execution Logging
│   └── index.ts         # Main exports
│
├── tests/               # Test files
├── docs/                # Documentation
├── dist/                # Built output
├── package.json
├── tsconfig.json
└── tsup.config.ts       # Build configuration
```

---

## Coding Standards

### TypeScript

- Strict mode enabled
- Explicit types for public APIs
- Use `interface` for object types
- Use `type` for unions/aliases

```typescript
// Good
interface ToolSpec {
  name: string;
  description: string;
}

// Good
type LLMProvider = 'anthropic' | 'openai' | 'google';

// Avoid
const tool: any = {};
```

### Formatting

We use ESLint and Prettier:

```bash
# Format code
pnpm run lint --fix

# Check formatting
pnpm run lint
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `tool-spec.ts` |
| Classes | PascalCase | `ToolFactoryAgent` |
| Functions | camelCase | `generateServer` |
| Constants | UPPER_SNAKE | `DEFAULT_MODEL` |
| Interfaces | PascalCase | `GeneratedServer` |
| Enums | PascalCase | `LLMProvider` |

### Comments

- Use JSDoc for public APIs
- Inline comments for complex logic
- Keep comments up to date

```typescript
/**
 * Generate MCP server from natural language description.
 *
 * @param description - Natural language description of tools
 * @param options - Generation options
 * @returns Generated server with all artifacts
 *
 * @example
 * ```typescript
 * const server = await agent.generateFromDescription(
 *   'Create weather tools',
 *   { serverName: 'weather-server' }
 * );
 * ```
 */
async generateFromDescription(
  description: string,
  options?: GenerateOptions
): Promise<GeneratedServer> {
  // ...
}
```

---

## Testing

### Run Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test -- --watch

# Specific file
pnpm test -- src/validation/parser.test.ts

# Coverage
pnpm test -- --coverage
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { validateTypeScriptCode } from '../validation/parser';

describe('validateTypeScriptCode', () => {
  it('should validate correct TypeScript', async () => {
    const result = await validateTypeScriptCode('const x: number = 42;');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should catch syntax errors', async () => {
    const result = await validateTypeScriptCode('const x = {');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

### Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| Unit | `tests/unit/` | Individual functions |
| Integration | `tests/integration/` | Component interaction |
| E2E | `tests/e2e/` | Full generation flow |

### Mocking LLM Calls

For unit tests, mock LLM providers:

```typescript
import { vi } from 'vitest';

vi.mock('../providers/anthropic', () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    call: vi.fn().mockResolvedValue({
      text: '{"tools": [...]}',
      latencyMs: 100,
    }),
  })),
}));
```

---

## Pull Requests

### Before Submitting

1. **Create an issue** first to discuss the change
2. **Fork** the repository
3. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
4. **Make changes** following coding standards
5. **Add tests** for new functionality
6. **Run checks**:
   ```bash
   pnpm run typecheck
   pnpm run lint
   pnpm test
   pnpm run build
   ```

### Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance

**Examples:**
```
feat(agent): add generateFromDatabase method
fix(openapi): handle missing operationId
docs(readme): add database examples
test(validation): add TypeScript syntax tests
```

### PR Template

```markdown
## Description

Brief description of changes.

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Added unit tests
- [ ] Added integration tests
- [ ] All tests pass

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. Automated checks run (lint, test, build)
2. Code review by maintainers
3. Address feedback
4. Merge when approved

---

## Adding Features

### New LLM Provider

Since v0.3.0, all Vercel AI SDK providers are handled by `UnifiedLLMProvider`. To add a new AI SDK provider:

1. Add the enum value and models in `src/config/providers.ts`:

```typescript
export enum LLMProvider {
  // ...
  NEW_PROVIDER = 'new_provider',
}
```

2. Add a `case` in `UnifiedLLMProvider.resolveModel()` (`src/providers/llm-provider.ts`):

```typescript
case LLMProvider.NEW_PROVIDER: {
  const { createNewProvider } = await import('@ai-sdk/new-provider');
  const provider = createNewProvider({ apiKey: this.apiKey });
  this.modelInstance = provider(this.model);
  break;
}
```

3. Add pricing in `src/config/pricing.ts` and the package name in `getPackageName()`.

For non-AI SDK providers, extend `BaseCachingProvider` directly (like `ClaudeCodeProvider`).

### New Template

1. Create template in `src/templates/`:

```handlebars
{{! src/templates/new-file.hbs }}
// Generated by MCP Tool Factory
{{#each items}}
{{this.name}}: {{this.value}}
{{/each}}
```

2. Load in generator:

```typescript
// src/generators/server.ts
this.newTemplate = Handlebars.compile(
  readFileSync(join(templateDir, 'new-file.hbs'), 'utf-8')
);
```

### New CLI Command

1. Add command in `src/cli/index.ts`:

```typescript
program
  .command('new-command')
  .description('Description of command')
  .option('-o, --option <value>', 'Option description')
  .action(async (options) => {
    // Implementation
  });
```

### New Input Source

To add a new input source (like GraphQL SDL or Ontology), follow this pattern:

1. Create a new directory under `src/` (e.g., `src/my-format/`):

```
src/my-format/
├── types.ts       # Type definitions for the parsed format
├── parser.ts      # Parser that converts raw input to typed definitions
├── generator.ts   # Generator that produces MCP server code + ToolSpec[]
└── index.ts       # Re-exports
```

2. Implement the generator class:

```typescript
// src/my-format/generator.ts
import type { ToolSpec } from '../models/tool-spec.js';
import { createToolSpec } from '../models/tool-spec.js';

export class MyFormatServerGenerator {
  constructor(private definition: MyDefinition) {}

  generateServerCode(serverName: string): string {
    // Return complete TypeScript MCP server code
  }

  getToolSpecs(): ToolSpec[] {
    // Return tool specifications for documentation/templates
  }
}
```

3. Add a generation method to `ToolFactoryAgent` in `src/agent/agent.ts`:

```typescript
async generateFromMyFormat(
  content: string,
  options?: { serverName?: string }
): Promise<GeneratedServer> {
  // Use dynamic import to keep the dependency optional
  const { MyFormatParser, MyFormatServerGenerator } = await import('../my-format/index.js');

  const parser = new MyFormatParser();
  const definition = parser.parse(content);
  const generator = new MyFormatServerGenerator(definition);

  const serverCode = generator.generateServerCode(options?.serverName ?? 'MyServer');
  const toolSpecs = generator.getToolSpecs();

  return createGeneratedServer({
    name: options?.serverName ?? 'MyServer',
    serverCode,
    toolSpecs,
    // ... generate other artifacts using this.serverGenerator, this.docsGenerator, etc.
  });
}
```

4. Optionally expose it as an MCP server tool in `src/server/index.ts`.

5. Add tests in `tests/` covering parsing and code generation.

---

## Release Process

Releases are automated via GitHub Actions:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create PR with version bump
4. After merge, tag release:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
5. GitHub Action publishes to npm

---

## Getting Help

- **Questions:** [GitHub Discussions](https://github.com/HeshamFS/mcp-tool-factory-ts/discussions)
- **Bugs:** [GitHub Issues](https://github.com/HeshamFS/mcp-tool-factory-ts/issues)

Thank you for contributing!
