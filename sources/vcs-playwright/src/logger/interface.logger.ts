export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogMetadata = Record<string, any>;

export interface Logger {
  trace(message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
  fatal(message: string, metadata?: LogMetadata): void;

  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}
