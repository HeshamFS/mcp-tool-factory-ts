#!/usr/bin/env node

/**
 * MCP Tool Factory CLI
 *
 * Generate MCP servers from natural language, OpenAPI specs, or database schemas.
 */

import('../dist/cli/index.js').catch((err) => {
  console.error('Failed to load MCP Tool Factory CLI:', err.message);
  process.exit(1);
});
