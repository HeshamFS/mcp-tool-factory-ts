import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'cli/index': 'src/cli/index.ts',
    'server/index': 'src/server/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node18',
  outDir: 'dist',
  shims: true,
  treeshake: true,
  external: [
    '@anthropic-ai/sdk',
    'openai',
    '@google/generative-ai',
    'better-sqlite3',
    'pg',
    'typescript', // Keep external - optional runtime dependency for validation
  ],
});
