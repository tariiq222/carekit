import { ConsoleLogger, Injectable } from '@nestjs/common';
import { correlationStorage } from '../middleware/correlation-id.middleware.js';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context: string | undefined;
  correlationId: string | null;
  trace?: string;
}

/**
 * Custom logger that extends NestJS ConsoleLogger.
 *
 * - **Development**: human-readable coloured output (default ConsoleLogger).
 * - **Production**: one-line JSON per log entry (structured logging).
 *
 * The correlation ID is pulled automatically from AsyncLocalStorage
 * so callers never need to pass it explicitly.
 */
@Injectable()
export class StructuredLogger extends ConsoleLogger {
  private readonly isProduction =
    process.env['NODE_ENV'] === 'production';

  log(message: string, context?: string): void {
    if (this.isProduction) {
      this.writeJson('info', message, context);
    } else {
      super.log(message, context);
    }
  }

  error(message: string, trace?: string, context?: string): void {
    if (this.isProduction) {
      this.writeJson('error', message, context, trace);
    } else {
      super.error(message, trace, context);
    }
  }

  warn(message: string, context?: string): void {
    if (this.isProduction) {
      this.writeJson('warn', message, context);
    } else {
      super.warn(message, context);
    }
  }

  debug(message: string, context?: string): void {
    if (this.isProduction) {
      this.writeJson('debug', message, context);
    } else {
      super.debug(message, context);
    }
  }

  verbose(message: string, context?: string): void {
    if (this.isProduction) {
      this.writeJson('verbose', message, context);
    } else {
      super.verbose(message, context);
    }
  }

  // ── private ──────────────────────────────────────────────

  private writeJson(
    level: string,
    message: string,
    context?: string,
    trace?: string,
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context || this.context,
      correlationId: correlationStorage.getStore() ?? null,
    };

    if (trace) {
      entry.trace = trace;
    }

    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + '\n');
  }
}
