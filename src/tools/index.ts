// src/tools/index.ts
import type { FastMCP } from 'fastmcp';
import { registerDocsTools } from './docs/index.js';
import { registerDriveTools } from './drive/index.js';
import { registerFormsTools } from './forms/index.js';
import { registerGmailTools } from './gmail/index.js';
import { registerSheetsTools } from './sheets/index.js';
import { registerUtilsTools } from './utils/index.js';

/**
 * Registers all tools with the FastMCP server.
 */
export function registerAllTools(server: FastMCP) {
  registerDocsTools(server);
  registerDriveTools(server);
  registerFormsTools(server);
  registerGmailTools(server);
  registerSheetsTools(server);
  registerUtilsTools(server);
}
