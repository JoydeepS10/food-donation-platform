import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env.ts';

export type ReadinessCheck = () => Promise<boolean>;

interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
}

export function createHealthController(
  config: AppConfig,
  readiness: ReadinessCheck = async () => true,
): RequestHandler {
  return async (_req, res) => {
    let ready = false;

    try {
      ready = await readiness();
    } catch {
      ready = false;
    }

    const body: HealthResponse = {
      status: ready ? 'ok' : 'degraded',
      version: config.APP_VERSION,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(body);
  };
}
