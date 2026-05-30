import pino from 'pino';

import { Logger, LogLevel, LogMetadata } from '@vcs-pw/logger/interface.logger';

export default class PinoLogger implements Logger {
  private logger: pino.Logger;

  constructor(options: pino.LoggerOptions, destination?: pino.DestinationStream) {
    this.logger = pino(options, destination);
  }

  trace(message: string, metadata?: LogMetadata): void {
    this.logger.trace({ ...metadata, message });
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug({ ...metadata, message });
  }

  info(message: string, metadata?: LogMetadata): void {
    this.logger.info({ ...metadata, message });
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn({ ...metadata, message });
  }

  error(message: string, metadata?: LogMetadata): void {
    this.logger.error({ ...metadata, message });
  }

  fatal(message: string, metadata?: LogMetadata): void {
    this.logger.fatal({ ...metadata, message });
  }

  setLevel(level: LogLevel): void {
    this.logger.level = level;
  }

  getLevel(): LogLevel {
    return this.logger.level as LogLevel;
  }
}

export const isoDateTimeFormat = pino.stdTimeFunctions.isoTime;
export type { Bindings } from 'pino';
