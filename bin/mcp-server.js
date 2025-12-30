#!/usr/bin/env node

/**
 * MCP Tool Factory Server
 *
 * An MCP server that exposes tools for generating MCP servers.
 * Use this with Claude Desktop, Claude Code, or any MCP client.
 */

import('../dist/server/index.js').catch((err) => {
  console.error('Failed to load MCP Tool Factory Server:', err.message);
  process.exit(1);
});
