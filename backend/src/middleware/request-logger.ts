import type { RequestHandler } from 'express';
import type { Logger } from '../utils/logger.ts';

export function createRequestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
      const durationMs = Math.round((Number(elapsedNanoseconds) / 1_000_000) * 10) / 10;
      const queryStart = req.originalUrl.indexOf('?');
      const path = queryStart === -1 ? req.originalUrl : req.originalUrl.slice(0, queryStart);

      logger.info('request.completed', {
        requestId: req.requestId,
        method: req.method,
        path,
        status: res.statusCode,
        durationMs,
      });
    });

    next();
  };
}
