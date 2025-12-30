/**
 * A single web search query and its results.
 */
export interface WebSearchEntry {
  query: string;
  results: string;
  sources: string[];
  timestamp: string;
}

/**
 * Create a WebSearchEntry with current timestamp.
 */
export function createWebSearchEntry(
  query: string,
  results: string,
  sources: string[] = []
): WebSearchEntry {
  return {
    query,
    results,
    sources,
    timestamp: new Date().toISOString(),
  };
}

/**
 * A single step in the generation process.
 */
export interface GenerationStep {
  stepName: string;
  description: string;
  inputData?: string | null;
  outputData?: string | null;
  timestamp: string;
}

/**
 * Create a GenerationStep with current timestamp.
 */
export function createGenerationStep(
  stepName: string,
  description: string,
  inputData?: string | null,
  outputData?: string | null
): GenerationStep {
  return {
    stepName,
    description,
    inputData: inputData ?? null,
    outputData: outputData ?? null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Complete log of the generation process.
 */
export interface GenerationLog {
  // Metadata
  serverName: string;
  createdAt: string;

  // Configuration
  provider: string;
  model: string;
  webSearchEnabled: boolean;

  // Input
  originalDescription: string;
  enhancedDescription: string;

  // Web search results
  webSearches: WebSearchEntry[];

  // Generation steps
  steps: GenerationStep[];

  // Output summary
  toolsGenerated: string[];
  dependenciesUsed: string[];
}

/**
 * Create a new GenerationLog.
 */
export function createGenerationLog(serverName: string): GenerationLog {
  return {
    serverName,
    createdAt: new Date().toISOString(),
    provider: '',
    model: '',
    webSearchEnabled: false,
    originalDescription: '',
    enhancedDescription: '',
    webSearches: [],
    steps: [],
    toolsGenerated: [],
    dependenciesUsed: [],
  };
}

/**
 * Add a generation step to the log.
 */
export function addStep(
  log: GenerationLog,
  name: string,
  description: string,
  inputData?: string | null,
  outputData?: string | null
): void {
  log.steps.push(createGenerationStep(name, description, inputData, outputData));
}

/**
 * Add a web search entry to the log.
 */
export function addWebSearch(
  log: GenerationLog,
  query: string,
  results: string,
  sources?: string[]
): void {
  log.webSearches.push(createWebSearchEntry(query, results, sources ?? []));
}

/**
 * Generate a markdown representation of the log.
 */
export function generationLogToMarkdown(log: GenerationLog): string {
  const lines: string[] = [
    `# Generation Log: ${log.serverName}`,
    '',
    `**Created:** ${log.createdAt}`,
    `**Provider:** ${log.provider}`,
    `**Model:** ${log.model}`,
    `**Web Search:** ${log.webSearchEnabled ? 'Enabled' : 'Disabled'}`,
    '',
    '---',
    '',
    '## Original Request',
    '',
    '```',
    log.originalDescription,
    '```',
    '',
  ];

  // Web search section
  if (log.webSearches.length > 0) {
    lines.push('---', '', '## Web Research', '', 'The following web searches were performed to gather context:', '');

    log.webSearches.forEach((search, i) => {
      const truncatedResults = search.results.length > 2000
        ? search.results.slice(0, 2000) + '...'
        : search.results;

      lines.push(`### Search ${i + 1}: \`${search.query}\``, '', truncatedResults, '');

      if (search.sources.length > 0) {
        lines.push('**Sources:**');
        search.sources.slice(0, 5).forEach((source) => {
          lines.push(`- ${source}`);
        });
        lines.push('');
      }
    });
  }

  // Enhanced description
  if (log.enhancedDescription && log.enhancedDescription !== log.originalDescription) {
    const truncated = log.enhancedDescription.length > 3000
      ? log.enhancedDescription.slice(0, 3000) + '...'
      : log.enhancedDescription;

    lines.push(
      '---',
      '',
      '## Enhanced Description (with research)',
      '',
      '```',
      truncated,
      '```',
      ''
    );
  }

  // Generation steps
  if (log.steps.length > 0) {
    lines.push('---', '', '## Generation Steps', '');

    log.steps.forEach((step, i) => {
      lines.push(`### Step ${i + 1}: ${step.stepName}`, '', step.description, '');

      if (step.inputData) {
        const truncated = step.inputData.length > 1000
          ? step.inputData.slice(0, 1000) + '...'
          : step.inputData;
        lines.push(
          '<details>',
          '<summary>Input Data</summary>',
          '',
          '```',
          truncated,
          '```',
          '</details>',
          ''
        );
      }

      if (step.outputData) {
        const truncated = step.outputData.length > 1000
          ? step.outputData.slice(0, 1000) + '...'
          : step.outputData;
        lines.push(
          '<details>',
          '<summary>Output Data</summary>',
          '',
          '```',
          truncated,
          '```',
          '</details>',
          ''
        );
      }
    });
  }

  // Tools generated
  if (log.toolsGenerated.length > 0) {
    lines.push('---', '', '## Tools Generated', '');
    log.toolsGenerated.forEach((tool) => {
      lines.push(`- \`${tool}\``);
    });
    lines.push('');
  }

  // Dependencies
  if (log.dependenciesUsed.length > 0) {
    lines.push('## Dependencies', '');
    log.dependenciesUsed.forEach((dep) => {
      lines.push(`- \`${dep}\``);
    });
    lines.push('');
  }

  return lines.join('\n');
}
