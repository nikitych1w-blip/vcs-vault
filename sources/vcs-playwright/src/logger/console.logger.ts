import { Logger, LogLevel, LogMetadata } from '@vcs-pw/logger/interface.logger';
import { inspect } from 'util';

export default class ConsoleLogger implements Logger {
  private level: LogLevel = 'info';
  private readonly levelOrder: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  private readonly inspectOptions = {
    depth: 6,
    colors: true,
    breakLength: 80,
    compact: false,
    sorted: false,
  };

  trace(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('trace')) {
      this.log('[TRACE]', message, metadata, 'log');
    }
  }

  debug(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('debug')) {
      this.log('[DEBUG]', message, metadata, 'log');
    }
  }

  info(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('info')) {
      this.log('[INFO]', message, metadata, 'log');
    }
  }

  warn(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('warn')) {
      this.log('[WARN]', message, metadata, 'warn');
    }
  }

  error(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('error')) {
      this.log('[ERROR]', message, metadata, 'error');
    }
  }

  fatal(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog('fatal')) {
      this.log('[FATAL]', message, metadata, 'error');
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelOrder[level] >= this.levelOrder[this.level];
  }

  private log(prefix: string, message: string, metadata?: LogMetadata, method: 'log' | 'warn' | 'error' = 'log'): void {
    const consoleMethod = console[method].bind(console);

    if (metadata && Object.keys(metadata).length > 0) {
      const metaLines = Object.entries(metadata)
        .map(([key, value]) => {
          if (value && typeof value === 'object') {
            const inspected = inspect(value, this.inspectOptions);
            return `    ${key}:\n${inspected
              .split('\n')
              .map((line) => `      ${line}`)
              .join('\n')}`;
          }
          return `    ${key}: ${value}`;
        })
        .join('\n');

      consoleMethod(`${prefix} ${message}\n${metaLines}`);
    } else {
      consoleMethod(`${prefix} ${message}`);
    }
  }
}
