import express from 'express';
import type { Express } from 'express';
import { API_PREFIX, JSON_BODY_LIMIT } from './config/constants.ts';
import type { AppConfig } from './config/env.ts';
import type { ReadinessCheck } from './controllers/health.controller.ts';
import { createCors } from './middleware/cors.ts';
import { createErrorHandler } from './middleware/error-handler.ts';
import { notFound } from './middleware/not-found.ts';
import { createRequestLogger } from './middleware/request-logger.ts';
import { requestId } from './middleware/request-id.ts';
import { createSecurityHeaders } from './middleware/security-headers.ts';
import { createApiRouter } from './routes/index.ts';
import { createLogger } from './utils/logger.ts';

export function createApp(config: AppConfig, readiness?: ReadinessCheck): Express {
  const app = express();
  const logger = createLogger(config.LOG_LEVEL);

  app.disable('x-powered-by');

  if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(requestId);
  app.use(createRequestLogger(logger));
  app.use(createSecurityHeaders(config));
  app.use(createCors(config));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use(API_PREFIX, createApiRouter(config, readiness));

  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
