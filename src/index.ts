#!/usr/bin/env node

// src/index.ts
//
// Single entry point for the Google Workspace MCP Server.
//
// Usage:
//   @pickuperast/google-workspace-mcp          Start the MCP server (default)
//   @pickuperast/google-workspace-mcp auth     Run the interactive OAuth flow

import { FastMCP } from 'fastmcp';
import {
  buildCachedToolsListPayload,
  collectToolsWhileRegistering,
  installCachedToolsListHandler,
} from './cachedToolsList.js';
import { initializeGoogleClient } from './clients.js';
import { registerAllTools } from './tools/index.js';
import { fastMcpLogger, logger } from './logger.js';

// --- Auth subcommand ---
if (process.argv[2] === 'auth') {
  const { runAuthFlow } = await import('./auth.js');
  try {
    await runAuthFlow();
    logger.info('Authorization complete. You can now start the MCP server.');
    process.exit(0);
  } catch (error: any) {
    logger.error('Authorization failed:', error.message || error);
    process.exit(1);
  }
}

// --- Server startup ---

// Set up process-level unhandled error/rejection handlers to prevent crashes
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

const server = new FastMCP({
  name: 'Ultimate Google Docs & Sheets MCP Server',
  version: '1.0.0',
  logger: fastMcpLogger,
  ping: {
    logLevel: 'error',
  },
});

const registeredTools: Parameters<FastMCP['addTool']>[0][] = [];
collectToolsWhileRegistering(server, registeredTools);
registerAllTools(server);

try {
  await initializeGoogleClient();
  logger.info('Starting Ultimate Google Docs & Sheets MCP server...');

  const cachedToolsList = await buildCachedToolsListPayload(registeredTools);
  const transportType =
    process.env.MCP_TRANSPORT === 'http' || process.env.MCP_TRANSPORT === 'httpStream'
      ? ('httpStream' as const)
      : ('stdio' as const);

  if (transportType === 'httpStream') {
    const port = Number.parseInt(process.env.PORT ?? process.env.MCP_PORT ?? '8080', 10);
    const host = process.env.MCP_HOST ?? '0.0.0.0';
    const endpoint = (process.env.MCP_ENDPOINT?.startsWith('/')
      ? process.env.MCP_ENDPOINT
      : `/${process.env.MCP_ENDPOINT ?? 'mcp'}`) as `/${string}`;
    const stateless = process.env.MCP_STATELESS === 'true';

    await server.start({
      transportType,
      httpStream: {
        endpoint,
        host,
        port,
        stateless,
      },
    });
    logger.info(`MCP Server running using HTTP stream at http://${host}:${port}${endpoint}`);
    logger.info(`SSE fallback available at http://${host}:${port}/sse`);
  } else {
    await server.start({ transportType });
    logger.info('MCP Server running using stdio. Awaiting client connection...');
  }

  installCachedToolsListHandler(server, cachedToolsList);
  logger.info('Process-level error handling configured to prevent crashes from timeout errors.');
} catch (startError: any) {
  logger.error('FATAL: Server failed to start:', startError.message || startError);
  process.exit(1);
}
