import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ToolSpec } from './tool-spec.js';
import type { ResourceSpec } from './resource-spec.js';
import type { PromptSpec } from './prompt-spec.js';
import type { GenerationLog } from './generation-log.js';
import { generationLogToMarkdown } from './generation-log.js';

/**
 * Output from the tool factory.
 */
export interface GeneratedServer {
  /** Server name */
  name: string;
  /** Main server source code */
  serverCode: string;
  /** List of tool specifications */
  toolSpecs: ToolSpec[];
  /** Test file content */
  testCode: string;
  /** Dockerfile content */
  dockerfile: string;
  /** README content */
  readme: string;
  /** Skill file for Claude Code */
  skillFile: string;
  /** package.json content */
  packageJson: string;
  /** tsconfig.json content */
  tsconfigJson: string;
  /** GitHub Actions workflow YAML */
  githubActions: string;
  /** server.json for MCP Registry */
  serverJson: string;
  /** CHANGELOG.md content */
  changelog: string;
  /** docs/tools.json - machine-readable API spec */
  toolsSpec: string;
  /** docs/index.md - API documentation entry point */
  apiDocsIndex: string;
  /** Resource specifications */
  resourceSpecs: ResourceSpec[];
  /** Prompt specifications */
  promptSpecs: PromptSpec[];
  /** Execution log for tracing */
  executionLog?: GenerationLog | null;
}

/**
 * Create a GeneratedServer with defaults.
 */
export function createGeneratedServer(
  partial: Partial<GeneratedServer> & Pick<GeneratedServer, 'name' | 'serverCode' | 'toolSpecs'>
): GeneratedServer {
  return {
    name: partial.name,
    serverCode: partial.serverCode,
    toolSpecs: partial.toolSpecs,
    testCode: partial.testCode ?? '',
    dockerfile: partial.dockerfile ?? '',
    readme: partial.readme ?? '',
    skillFile: partial.skillFile ?? '',
    packageJson: partial.packageJson ?? '',
    tsconfigJson: partial.tsconfigJson ?? '',
    githubActions: partial.githubActions ?? '',
    serverJson: partial.serverJson ?? '',
    changelog: partial.changelog ?? '',
    toolsSpec: partial.toolsSpec ?? '',
    apiDocsIndex: partial.apiDocsIndex ?? '',
    resourceSpecs: partial.resourceSpecs ?? [],
    promptSpecs: partial.promptSpecs ?? [],
    executionLog: partial.executionLog ?? null,
  };
}

/**
 * Write all generated files to a directory.
 */
export async function writeServerToDirectory(
  server: GeneratedServer,
  outputPath: string
): Promise<void> {
  // Create directories
  await mkdir(outputPath, { recursive: true });
  await mkdir(join(outputPath, 'src'), { recursive: true });
  await mkdir(join(outputPath, 'tests'), { recursive: true });

  // Write main files
  await writeFile(join(outputPath, 'src', 'index.ts'), server.serverCode);
  await writeFile(join(outputPath, 'tests', 'tools.test.ts'), server.testCode);
  await writeFile(join(outputPath, 'Dockerfile'), server.dockerfile);
  await writeFile(join(outputPath, 'README.md'), server.readme);
  await writeFile(join(outputPath, 'skill.md'), server.skillFile);
  await writeFile(join(outputPath, 'package.json'), server.packageJson);
  await writeFile(join(outputPath, 'tsconfig.json'), server.tsconfigJson);

  // Write CHANGELOG.md
  if (server.changelog) {
    await writeFile(join(outputPath, 'CHANGELOG.md'), server.changelog);
  }

  // Write docs directory
  if (server.toolsSpec || server.apiDocsIndex) {
    const docsDir = join(outputPath, 'docs');
    await mkdir(docsDir, { recursive: true });

    if (server.toolsSpec) {
      await writeFile(join(docsDir, 'tools.json'), server.toolsSpec);
    }
    if (server.apiDocsIndex) {
      await writeFile(join(docsDir, 'index.md'), server.apiDocsIndex);
    }
  }

  // Write server.json for MCP Registry
  if (server.serverJson) {
    await writeFile(join(outputPath, 'server.json'), server.serverJson);
  }

  // Write GitHub Actions workflow
  if (server.githubActions) {
    const workflowsDir = join(outputPath, '.github', 'workflows');
    await mkdir(workflowsDir, { recursive: true });
    await writeFile(join(workflowsDir, 'ci.yml'), server.githubActions);
  }

  // Write execution log if available
  if (server.executionLog) {
    await writeFile(
      join(outputPath, 'EXECUTION_LOG.md'),
      generationLogToMarkdown(server.executionLog)
    );
    await writeFile(
      join(outputPath, 'execution_log.json'),
      JSON.stringify(server.executionLog, null, 2)
    );
  }
}
