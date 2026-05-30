import { config } from '@vcs-pw/config';
import ConsoleLogger from '@vcs-pw/logger/console.logger';
import { Logger, LogLevel } from '@vcs-pw/logger/interface.logger';
import PinoLogger, { Bindings, isoDateTimeFormat } from '@vcs-pw/logger/pino.logger';

class LoggerFactory {
  static createLogger(type: string, level: LogLevel): Logger {
    switch (type) {
      case 'pino':
        let options = {
          level: level,
          timestamp: isoDateTimeFormat,
          formatters: {
            level: (label: string) => {
              return { level: label.toUpperCase() };
            },
            bindings(bindings: Bindings) {
              const { pid, hostname, ...rest } = bindings;
              return rest;
            },
          },
        };
        return new PinoLogger(options);
      case 'console':
        let logger = new ConsoleLogger();
        logger.setLevel(level);
        return logger;
      default:
        throw new Error(`Тип логгера ${type} не поддерживается. Доступные значения: 'pino' и 'console'.`);
    }
  }
}

export const log = LoggerFactory.createLogger(config.logging.type, config.logging.level);
