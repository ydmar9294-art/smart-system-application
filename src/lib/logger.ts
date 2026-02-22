/**
 * Production Logger
 * Structured logging with severity levels, context, and optional remote reporting
 * Replaces raw console.log/error with structured, filterable log entries
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  timestamp: string;
  userId?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

// In production, suppress debug logs
const MIN_LOG_LEVEL: LogLevel = import.meta.env.PROD ? 'info' : 'debug';

// Circular buffer for recent logs (useful for error reports)
const LOG_BUFFER_SIZE = 100;
const logBuffer: LogEntry[] = [];

let currentUserId: string | undefined;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  const prefix = `[${entry.level.toUpperCase()}]`;
  const ctx = entry.context ? ` [${entry.context}]` : '';
  return `${prefix}${ctx} ${entry.message}`;
}

function pushToBuffer(entry: LogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
}

function log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
    userId: currentUserId,
  };

  pushToBuffer(entry);

  const formatted = formatEntry(entry);

  switch (level) {
    case 'debug':
      console.debug(formatted, data || '');
      break;
    case 'info':
      console.info(formatted, data || '');
      break;
    case 'warn':
      console.warn(formatted, data || '');
      break;
    case 'error':
    case 'critical':
      console.error(formatted, data || '');
      break;
  }
}

export const logger = {
  debug: (msg: string, ctx?: string, data?: Record<string, unknown>) => log('debug', msg, ctx, data),
  info: (msg: string, ctx?: string, data?: Record<string, unknown>) => log('info', msg, ctx, data),
  warn: (msg: string, ctx?: string, data?: Record<string, unknown>) => log('warn', msg, ctx, data),
  error: (msg: string, ctx?: string, data?: Record<string, unknown>) => log('error', msg, ctx, data),
  critical: (msg: string, ctx?: string, data?: Record<string, unknown>) => log('critical', msg, ctx, data),

  /** Set current user ID for log attribution */
  setUser: (userId: string | undefined) => {
    currentUserId = userId;
  },

  /** Get recent log buffer (for error reports) */
  getRecentLogs: (): ReadonlyArray<LogEntry> => [...logBuffer],

  /** Clear log buffer */
  clearBuffer: () => {
    logBuffer.length = 0;
  },
};
