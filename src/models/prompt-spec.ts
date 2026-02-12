/**
 * Prompt specification for MCP servers.
 *
 * Prompts are reusable templates that LLMs can discover
 * and use for guided workflows.
 *
 * @packageDocumentation
 */

/**
 * Argument for a prompt template.
 */
export interface PromptArgument {
  /** Argument name */
  name: string;
  /** Description of the argument */
  description: string;
  /** Whether the argument is required */
  required: boolean;
}

/**
 * Specification for an MCP prompt.
 */
export interface PromptSpec {
  /** Prompt name in snake_case */
  name: string;
  /** Description of what the prompt does */
  description: string;
  /** Arguments the prompt accepts */
  arguments: PromptArgument[];
  /** The prompt template text (can reference arguments with ${argName}) */
  template: string;
}

/**
 * Create a PromptSpec with defaults.
 *
 * Defaults: `arguments` to an empty array.
 *
 * @param partial - Partial spec; `name`, `description`, and `template` are required
 * @returns Complete PromptSpec
 */
export function createPromptSpec(
  partial: Partial<PromptSpec> & Pick<PromptSpec, 'name' | 'description' | 'template'>
): PromptSpec {
  return {
    name: partial.name,
    description: partial.description,
    arguments: partial.arguments ?? [],
    template: partial.template,
  };
}
