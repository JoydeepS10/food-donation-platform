import type { Server } from 'node:http';
import { createApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import type { AppConfig } from './config/env.ts';
import { createLogger } from './utils/logger.ts';
import { describeErrorForLog } from './utils/safe-error-log.ts';

function main(): void {
  let config: AppConfig;

  try {
    config = loadEnv();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown environment configuration error.';
    console.error(message);
    process.exit(1);
  }

  const logger = createLogger(config.LOG_LEVEL);
  const app = createApp(config);
  const server: Server = app.listen(config.PORT, () => {
    logger.info('server.started', {
      environment: config.NODE_ENV,
      port: config.PORT,
    });
  });

  server.on('error', (error) => {
    logger.error('server.error', {
      error: describeErrorForLog(error),
    });
    process.exitCode = 1;
  });

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info('server.stopping', { signal });

    server.close((error) => {
      if (error) {
        logger.error('server.shutdown_failed', {
          error: describeErrorForLog(error),
        });
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

main();
