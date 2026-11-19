import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env.ts';

const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,X-Request-Id';

export function createCors(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    res.vary('Origin');

    const origin = req.headers.origin;
    const originAllowed = typeof origin === 'string' && origin === config.FRONTEND_URL;

    if (originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', config.FRONTEND_URL);
      res.setHeader('Access-Control-Allow-Credentials', 'true');

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        res.setHeader('Access-Control-Max-Age', '600');
        res.status(204).end();
        return;
      }
    } else if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
