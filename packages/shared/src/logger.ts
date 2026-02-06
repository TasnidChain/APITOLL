/**
 * Structured logging module for AgentCommerce.
 * Outputs JSON logs in production, pretty logs in development.
 * Compatible with common log aggregation tools (Datadog, Grafana, etc.)
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  pretty?: boolean;
}

export class Logger {
  private service: string;
  private minLevel: number;
  private pretty: boolean;

  constructor(options: LoggerOptions) {
    this.service = options.service;
    this.minLevel = LOG_LEVELS[options.level ?? "info"];
    this.pretty = options.pretty ?? process.env.NODE_ENV !== "production";
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log("error", message, data);
  }

  /**
   * Create a child logger with additional context fields.
   */
  child(context: Record<string, unknown>): ChildLogger {
    return new ChildLogger(this, context);
  }

  /**
   * Log a request/response cycle with timing.
   */
  request(method: string, path: string, status: number, durationMs: number, extra?: Record<string, unknown>): void {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    this.log(level, `${method} ${path} ${status}`, {
      method,
      path,
      status,
      durationMs,
      ...extra,
    });
  }

  /**
   * Log a transaction event.
   */
  transaction(event: string, data: Record<string, unknown>): void {
    this.info(`tx:${event}`, { ...data, category: "transaction" });
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...data,
    };

    if (this.pretty) {
      const color = level === "error" ? "\x1b[31m" : level === "warn" ? "\x1b[33m" : level === "debug" ? "\x1b[90m" : "\x1b[36m";
      const reset = "\x1b[0m";
      const dataStr = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";
      const output = `${color}[${this.service}] ${level.toUpperCase()}${reset} ${message}${dataStr}`;

      if (level === "error") {
        console.error(output);
      } else if (level === "warn") {
        console.warn(output);
      } else {
        console.log(output);
      }
    } else {
      // Structured JSON for production
      const output = JSON.stringify(entry);
      if (level === "error") {
        console.error(output);
      } else {
        console.log(output);
      }
    }
  }
}

class ChildLogger {
  private parent: Logger;
  private context: Record<string, unknown>;

  constructor(parent: Logger, context: Record<string, unknown>) {
    this.parent = parent;
    this.context = context;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.context, ...data });
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.context, ...data });
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.context, ...data });
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.parent.error(message, { ...this.context, ...data });
  }
}

/**
 * Create a logger for a specific service.
 */
export function createLogger(service: string, options?: Partial<LoggerOptions>): Logger {
  return new Logger({
    service,
    ...options,
  });
}

// Pre-configured loggers for common services
export const loggers = {
  sellerSdk: createLogger("seller-sdk"),
  buyerSdk: createLogger("buyer-sdk"),
  indexer: createLogger("indexer"),
  discovery: createLogger("discovery"),
  dashboard: createLogger("dashboard"),
  billing: createLogger("billing"),
  platform: createLogger("platform"),
};
