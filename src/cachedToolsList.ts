// FastMCP's default tools/list handler runs toJsonSchema() for every tool on every request.
// Hosts that poll tools/list frequently (or many concurrent sessions) then burn a full CPU core.
// We precompute the list once before stdio connects, then replace the handler to return that snapshot.

import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { FastMCP } from 'fastmcp';
import { toJsonSchema } from 'xsschema';
import { logger } from './logger.js';

type AddToolArg = Parameters<FastMCP['addTool']>[0];

function truncate(value: string, max = 160): string {
  return value.length > max ? `${value.slice(0, max)}...(${value.length} chars)` : value;
}

function sanitizeForLog(value: unknown): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    return truncate(value.replace(/\s+/g, ' ').trim());
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > 10) {
      return {
        itemCount: value.length,
        preview: value.slice(0, 5).map(sanitizeForLog),
      };
    }
    return value.map(sanitizeForLog);
  }

  if (typeof value === 'object') {
    const redactedKeys = new Set([
      'raw',
      'rawmime',
      'token',
      'refresh_token',
      'client_secret',
      'google_client_secret',
      'authorization',
      'access_token',
      'service_account_path',
    ]);
    const bulkyKeys = new Set([
      'bodyText',
      'bodyHtml',
      'text',
      'markdown',
      'htmlBody',
      'textBody',
      'rawSubject',
      'content',
      'values',
      'data',
    ]);

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => {
        const lower = key.toLowerCase();
        if (redactedKeys.has(lower)) return [key, '[redacted]'];
        if (bulkyKeys.has(key)) {
          if (typeof inner === 'string') return [key, truncate(inner)];
          if (Array.isArray(inner)) return [key, { itemCount: inner.length }];
        }
        return [key, sanitizeForLog(inner)];
      })
    );
  }

  return String(value);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(sanitizeForLog(value));
  } catch {
    return '"[unserializable]"';
  }
}

function parsePotentialJson(result: unknown): unknown {
  if (typeof result !== 'string') return result;
  const trimmed = result.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return result;

  try {
    return JSON.parse(trimmed);
  } catch {
    return result;
  }
}

function collectIds(value: unknown, out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value == null) return out;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) collectIds(item, out);
    return out;
  }
  if (typeof value !== 'object') return out;

  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (
      (lower.endsWith('id') || lower === 'id' || lower.endsWith('ids')) &&
      out[key] === undefined &&
      (typeof inner === 'string' || typeof inner === 'number' || Array.isArray(inner))
    ) {
      out[key] = Array.isArray(inner) ? inner.slice(0, 5) : inner;
    }

    if (
      ['documentid', 'spreadsheetid', 'threadid', 'messageid', 'draftid', 'sheetid', 'commentid'].includes(
        lower
      ) &&
      out[key] === undefined
    ) {
      out[key] = inner;
    }

    if (typeof inner === 'object' && inner !== null) {
      collectIds(inner, out);
    }
  }

  return out;
}

function instrumentTool(tool: AddToolArg): AddToolArg {
  const originalExecute = tool.execute;

  return {
    ...tool,
    execute: async (args, context) => {
      const startedAt = Date.now();
      logger.info(`[TOOL] start name=${tool.name} args=${safeJson(args)}`);

      try {
        const result = await originalExecute(args, context);
        const durationMs = Date.now() - startedAt;
        const parsed = parsePotentialJson(result);
        const ids = collectIds(parsed);
        const idsPart = Object.keys(ids).length > 0 ? ` ids=${safeJson(ids)}` : '';
        logger.info(`[TOOL] success name=${tool.name} durationMs=${durationMs}${idsPart}`);
        return result;
      } catch (error: any) {
        const durationMs = Date.now() - startedAt;
        const details = {
          message: error?.message || String(error),
          code: error?.code ?? error?.response?.data?.error?.code ?? null,
          data: error?.response?.data ? sanitizeForLog(error.response.data) : undefined,
        };
        logger.error(
          `[TOOL] fail name=${tool.name} durationMs=${durationMs} error=${safeJson(details)}`
        );
        throw error;
      }
    },
  };
}

export function collectToolsWhileRegistering(server: FastMCP, out: AddToolArg[]): void {
  const add = server.addTool.bind(server);
  (server as unknown as { addTool: (tool: AddToolArg) => void }).addTool = (tool) => {
    const instrumented = instrumentTool(tool);
    out.push(instrumented);
    add(instrumented);
  };
}

export async function buildCachedToolsListPayload(tools: AddToolArg[]) {
  return {
    tools: await Promise.all(
      tools.map(async (tool) => ({
        annotations: tool.annotations,
        description: tool.description,
        inputSchema: tool.parameters
          ? await toJsonSchema(tool.parameters)
          : {
              additionalProperties: false,
              properties: {},
              type: 'object' as const,
            },
        name: tool.name,
      }))
    ),
  };
}

export function installCachedToolsListHandler(
  server: FastMCP,
  listPayload: Awaited<ReturnType<typeof buildCachedToolsListPayload>>
): void {
  const session = server.sessions[0];
  if (!session) {
    logger.warn('No MCP session; skipping tools/list cache install.');
    return;
  }

  session.server.setRequestHandler(ListToolsRequestSchema, async () => listPayload);
  logger.debug(`Installed cached tools/list (${listPayload.tools.length} tools).`);
}
