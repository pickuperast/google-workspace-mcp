// src/logger.ts
//
// Centralized logger with LOG_LEVEL support.
//
// Log levels (from most to least verbose):
//   debug  - Detailed diagnostic info (text range mapping, request building, etc.)
//   info   - General operational messages (server started, auth succeeded, etc.)
//   warn   - Potentially harmful situations (missing content, fallback behavior)
//   error  - Error conditions (API failures, auth failures, etc.)
//
// Set via the LOG_LEVEL environment variable. Defaults to "info".
// Example: LOG_LEVEL=debug npm start
//
// MCP servers communicate over stdout, so all log output goes to stderr.

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

function resolveLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVELS) {
    return env as LogLevel;
  }
  return 'info';
}

let currentLevel = resolveLevel();

/** Re-read LOG_LEVEL from the environment (useful for testing). */
export function refreshLogLevel(): void {
  currentLevel = resolveLevel();
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  debug(...args: unknown[]): void {
    if (shouldLog('debug')) {
      console.error('[DEBUG]', ...args);
    }
  },

  info(...args: unknown[]): void {
    if (shouldLog('info')) {
      console.error('[INFO]', ...args);
    }
  },

  warn(...args: unknown[]): void {
    if (shouldLog('warn')) {
      console.error('[WARN]', ...args);
    }
  },

  error(...args: unknown[]): void {
    if (shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  },
};

function serializeArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

const fastMcpWarningCache = new Map<string, number>();

function shouldSuppressFastMcpWarning(message: string): boolean {
  if (!message.includes('could not infer client capabilities after 10 attempts')) {
    return false;
  }

  const now = Date.now();
  const lastSeen = fastMcpWarningCache.get(message) ?? 0;
  if (now - lastSeen < 60000) {
    return true;
  }

  fastMcpWarningCache.set(message, now);
  return false;
}

export const fastMcpLogger = {
  debug(...args: unknown[]): void {
    const message = serializeArgs(args);
    if (message.includes('Stateless HTTP Stream request handled')) {
      return;
    }
    logger.debug('[FastMCP]', ...args);
  },

  info(...args: unknown[]): void {
    logger.info('[FastMCP]', ...args);
  },

  warn(...args: unknown[]): void {
    const message = serializeArgs(args);
    if (shouldSuppressFastMcpWarning(message)) {
      return;
    }
    logger.warn('[FastMCP]', ...args);
  },

  error(...args: unknown[]): void {
    logger.error('[FastMCP]', ...args);
  },

  log(...args: unknown[]): void {
    logger.info('[FastMCP]', ...args);
  },
};
