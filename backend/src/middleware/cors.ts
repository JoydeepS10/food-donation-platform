import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env.ts';
import { AppError } from '../utils/app-error.ts';

const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,X-Request-Id';
const EXPOSED_HEADERS = 'X-Request-Id';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createCors(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    res.vary('Origin');

    const origin = req.headers.origin;
    const originAllowed =
      typeof origin === 'string' && origin !== 'null' && origin === config.FRONTEND_URL;

    if (originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', config.FRONTEND_URL);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS);

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        res.setHeader('Access-Control-Max-Age', '600');
        res.status(204).end();
        return;
      }

      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const hasOrigin = typeof origin === 'string';
    const rejectForOrigin =
      STATE_CHANGING_METHODS.has(req.method) &&
      ((hasOrigin && !originAllowed) || (!hasOrigin && config.NODE_ENV === 'production'));

    if (rejectForOrigin) {
      next(new AppError(403, 'FORBIDDEN', 'Origin not allowed.'));
      return;
    }

    next();
  };
}
