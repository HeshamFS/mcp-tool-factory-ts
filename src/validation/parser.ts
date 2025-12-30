/**
 * Utilities for parsing LLM responses.
 */

/**
 * Extract JSON content from an LLM response that may contain markdown.
 */
export function extractJsonFromResponse(response: string): string {
  // Try to extract from markdown code blocks
  if (response.includes('```json')) {
    const parts = response.split('```json');
    if (parts.length > 1) {
      const jsonPart = parts[1]?.split('```')[0];
      if (jsonPart) {
        return jsonPart.trim();
      }
    }
  } else if (response.includes('```')) {
    const parts = response.split('```');
    if (parts.length > 1) {
      const jsonPart = parts[1]?.split('```')[0];
      if (jsonPart) {
        return jsonPart.trim();
      }
    }
  }

  // Try to find JSON array or object
  // Look for array first (tool specs are typically an array)
  const arrayMatch = response.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  // Look for object
  const objectMatch = response.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  return response.trim();
}

/**
 * Parse LLM response containing tool specifications.
 */
export function parseToolResponse(response: string): {
  data: unknown[];
  error?: string;
} {
  // Extract JSON from response
  const jsonStr = extractJsonFromResponse(response);

  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    // Try to fix common JSON issues
    // Remove trailing commas
    const fixed = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    try {
      data = JSON.parse(fixed);
    } catch {
      return {
        data: [],
        error: `Failed to parse tool specifications: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // Ensure we have a list
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    // Maybe it's wrapped in a key
    if ('tools' in obj && Array.isArray(obj.tools)) {
      data = obj.tools;
    } else if ('name' in obj) {
      // Single tool spec
      data = [data];
    } else {
      return {
        data: [],
        error: `Unexpected response format: expected array or object with 'name' property`,
      };
    }
  }

  if (!Array.isArray(data)) {
    return {
      data: [],
      error: `Expected list of tool specs, got: ${typeof data}`,
    };
  }

  return { data };
}

/**
 * Extract TypeScript code from an LLM response.
 */
export function extractCodeFromResponse(response: string): string {
  // Try to extract from markdown code blocks
  if (response.includes('```typescript')) {
    const parts = response.split('```typescript');
    if (parts.length > 1) {
      const codePart = parts[1]?.split('```')[0];
      if (codePart) {
        return codePart.trim();
      }
    }
  } else if (response.includes('```ts')) {
    const parts = response.split('```ts');
    if (parts.length > 1) {
      const codePart = parts[1]?.split('```')[0];
      if (codePart) {
        return codePart.trim();
      }
    }
  } else if (response.includes('```')) {
    const parts = response.split('```');
    if (parts.length > 1) {
      const codePart = parts[1]?.split('```')[0];
      if (codePart) {
        return codePart.trim();
      }
    }
  }

  return response.trim();
}

/**
 * Validate that TypeScript code is syntactically correct using the TypeScript compiler.
 * Falls back to basic bracket validation if TypeScript is not available.
 */
export async function validateTypeScriptCode(code: string): Promise<{
  valid: boolean;
  errors: Array<{ line: number; column: number; message: string }>;
  error?: string;
}> {
  // Basic checks
  if (!code || code.trim().length === 0) {
    return { valid: false, errors: [], error: 'Empty code' };
  }

  try {
    // Dynamic import to avoid bundling TypeScript
    const ts = await import('typescript');

    // Parse the code as a TypeScript source file
    const sourceFile = ts.createSourceFile(
      'generated.ts',
      code,
      ts.ScriptTarget.ESNext,
      true, // setParentNodes
      ts.ScriptKind.TS
    );

    // Collect syntax errors
    const errors: Array<{ line: number; column: number; message: string }> = [];

    // Check for parse diagnostics (syntax errors)
    // @ts-expect-error - parseDiagnostics is internal but available
    const parseDiagnostics = sourceFile.parseDiagnostics || [];

    for (const diagnostic of parseDiagnostics) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        diagnostic.start || 0
      );
      errors.push({
        line: line + 1,
        column: character + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      });
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        error: errors.map(e => `Line ${e.line}: ${e.message}`).join('; '),
      };
    }

    return { valid: true, errors: [] };
  } catch {
    // Fall back to basic bracket validation if TypeScript is not available
    return validateTypeScriptCodeBasic(code);
  }
}

/**
 * Basic TypeScript validation (bracket matching) as fallback.
 */
function validateTypeScriptCodeBasic(code: string): {
  valid: boolean;
  errors: Array<{ line: number; column: number; message: string }>;
  error?: string;
} {
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;

  for (const char of code) {
    switch (char) {
      case '{':
        braceCount++;
        break;
      case '}':
        braceCount--;
        break;
      case '(':
        parenCount++;
        break;
      case ')':
        parenCount--;
        break;
      case '[':
        bracketCount++;
        break;
      case ']':
        bracketCount--;
        break;
    }

    if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
      return { valid: false, errors: [], error: 'Unbalanced brackets' };
    }
  }

  if (braceCount !== 0) {
    return { valid: false, errors: [], error: 'Unbalanced curly braces' };
  }
  if (parenCount !== 0) {
    return { valid: false, errors: [], error: 'Unbalanced parentheses' };
  }
  if (bracketCount !== 0) {
    return { valid: false, errors: [], error: 'Unbalanced square brackets' };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate a complete generated server file.
 * Returns validation result with detailed error information.
 */
export async function validateGeneratedServer(serverCode: string): Promise<{
  valid: boolean;
  errors: Array<{ line: number; column: number; message: string }>;
  summary?: string;
}> {
  const result = await validateTypeScriptCode(serverCode);

  if (!result.valid) {
    return {
      valid: false,
      errors: result.errors,
      summary: `Generated server has ${result.errors.length} syntax error(s): ${result.error}`,
    };
  }

  return {
    valid: true,
    errors: [],
    summary: 'Generated server code is syntactically valid',
  };
}
