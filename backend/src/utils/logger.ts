export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

export type LogSink = (line: string, level: LogLevel) => void;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const defaultSink: LogSink = (line, level) => {
  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
};

export function createLogger(level: LogLevel, sink: LogSink = defaultSink): Logger {
  const shouldLog = (candidate: LogLevel): boolean => LEVEL_WEIGHT[candidate] >= LEVEL_WEIGHT[level];

  const write = (entryLevel: LogLevel, message: string, context?: LogContext): void => {
    if (!shouldLog(entryLevel)) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level: entryLevel,
      message,
      ...context,
    };

    sink(JSON.stringify(entry), entryLevel);
  };

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}
