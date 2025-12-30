/**
 * LLM prompts for the MCP Tool Factory.
 */

/**
 * System prompt establishing the AI's role and coding standards.
 */
export const SYSTEM_PROMPT = `You are an expert TypeScript developer specializing in building MCP (Model Context Protocol) servers.

Your code follows these principles:
1. Type safety - Always use TypeScript types and interfaces
2. Error resilience - Never let exceptions bubble up, return error objects
3. Clear documentation - JSDoc comments with @param and @returns
4. Production ready - Handle edge cases, validate inputs
5. Clean code - Follow ESLint best practices, readable, maintainable

When generating tool implementations:
- Use modern TypeScript (ES2022+) features
- Use explicit types, avoid 'any'
- Use descriptive variable names
- Keep functions focused and single-purpose
- Add comments only where logic is non-obvious`;

/**
 * Prompt for extracting tool specifications from a natural language description.
 */
export const EXTRACT_TOOLS_PROMPT = `You are a tool specification extractor. Analyze the user's description and identify distinct tools needed.

For each tool, determine:
1. A clear, descriptive name in snake_case
2. A concise description of what it does (one sentence)
3. All required and optional parameters with types
4. The expected return type and structure
5. Any external APIs or npm packages needed

User Description:
{description}

Return a JSON array where each element has this exact structure:
{
  "name": "tool_name_in_snake_case",
  "description": "What the tool does in one clear sentence.",
  "input_schema": {
    "type": "object",
    "properties": {
      "param1": {"type": "string", "description": "Description of param1"},
      "param2": {"type": "integer", "description": "Description of param2", "default": 10}
    },
    "required": ["param1"]
  },
  "output_schema": {
    "type": "object",
    "properties": {
      "result": {"type": "string", "description": "The result"}
    }
  },
  "implementation_hints": "Use library X to fetch data from Y...",
  "dependencies": ["axios", "lodash"]
}

Important:
- Use snake_case for tool names
- Every tool must have input_schema with "type": "object" and "properties"
- Be specific about parameter types (string, integer, number, boolean, array, object)
- Include default values where sensible
- List only the npm packages needed (not Node.js built-ins)

Return ONLY the JSON array, no other text.`;

/**
 * Prompt for generating TypeScript implementation of a tool.
 * The implementation will be embedded directly in an MCP server.tool() handler.
 */
export const GENERATE_IMPLEMENTATION_PROMPT = `Generate INLINE TypeScript code for this MCP tool implementation.

Tool Specification:
- Name: {name}
- Description: {description}
- Input Schema: {input_schema}
- Output Schema: {output_schema}
- Implementation Hints: {hints}
- Dependencies: {dependencies}

CRITICAL: Your code will be embedded directly inside this MCP tool handler:

server.tool(
  '{name}',
  'description',
  { /* zod params */ },
  async (params) => {
    try {
      // >>> YOUR CODE GOES HERE <<<
    } catch (e) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }] };
    }
  }
);

Requirements:
1. Generate INLINE CODE only - NO function definitions, NO interfaces
2. Use \`params\` directly - it contains the validated input parameters
3. Return MCP format: { content: [{ type: 'text', text: JSON.stringify(result) }] }
4. Validate inputs and return early with error if invalid
5. Do NOT wrap in try/catch - the outer handler already does that
6. Do NOT define interfaces or type aliases - params is already typed

CORRECT Example (inline code that uses params directly):
\`\`\`
// Validate inputs
if (!params.city || typeof params.city !== 'string') {
  return { content: [{ type: 'text', text: JSON.stringify({ error: 'city is required' }) }] };
}

// Make API call
const response = await axios.get('https://api.weather.com/v1/current', {
  params: { q: params.city, appid: process.env.WEATHER_API_KEY }
});

// Return result in MCP format
return {
  content: [{
    type: 'text',
    text: JSON.stringify({
      city: response.data.name,
      temperature: response.data.main.temp,
      conditions: response.data.weather[0].description
    })
  }]
};
\`\`\`

WRONG (do NOT do this):
- function tool_name(params) { ... }  // NO function definitions
- interface Params { ... }  // NO interface definitions
- return { result: value }  // WRONG format, must be MCP format

Return ONLY the inline TypeScript code, no markdown fences or explanations.`;

/**
 * Prompt for generating Jest tests for a tool.
 */
export const GENERATE_TESTS_PROMPT = `Generate Jest tests for this MCP tool.

Tool Specification:
- Name: {name}
- Description: {description}
- Input Schema: {input_schema}
- Output Schema: {output_schema}

Generate tests covering:
1. Happy path with valid inputs
2. Edge cases (empty strings, zero values, boundary conditions)
3. Invalid inputs (wrong types, missing required fields)
4. Error handling verification

Use this testing pattern with MCP client:
\`\`\`typescript
import { describe, it, expect, beforeAll } from '@jest/globals';

describe('{name}', () => {
  it('should succeed with valid input', async () => {
    const result = await callTool('{name}', {
      param1: 'value'
    });

    expect(result.error).toBeUndefined();
    expect(result.result).toBeDefined();
  });

  it('should handle missing required params', async () => {
    const result = await callTool('{name}', {});

    // Should not crash, may return error
    expect(result).toBeDefined();
  });

  it('should handle edge cases', async () => {
    const result = await callTool('{name}', {
      param1: ''  // Empty string
    });

    expect(result).toBeDefined();
  });
});
\`\`\`

Return ONLY the TypeScript test code, no markdown fences or explanations.`;

/**
 * Replace placeholders in a prompt template.
 */
export function formatPrompt(
  template: string,
  values: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}
