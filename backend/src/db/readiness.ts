import type { PrismaClient } from '@prisma/client';
import type { ReadinessCheck } from '../controllers/health.controller.ts';
import type { Logger } from '../utils/logger.ts';
import { describeErrorForLog } from '../utils/safe-error-log.ts';
import { prisma } from './prisma.ts';

export type DatabasePing = () => Promise<unknown>;

export function createPrismaDatabasePing(db: Pick<PrismaClient, '$queryRaw'>): DatabasePing {
  return async () => {
    await db.$queryRaw`SELECT 1`;
  };
}

/**
 * Readiness check used by `GET /api/v1/health`.
 *
 * A failed ping is logged without the Prisma message, query arguments or connection details.
 * The endpoint still returns HTTP 200 with `status: "degraded"`, as the contract requires, so
 * a database outage does not turn the health route into an HTML error page.
 */
export function createDatabaseReadiness(ping: DatabasePing, logger: Logger): ReadinessCheck {
  return async () => {
    try {
      await ping();
      return true;
    } catch (error) {
      logger.warn('database.readiness_failed', { ...describeErrorForLog(error) });
      return false;
    }
  };
}

export function createDefaultDatabaseReadiness(logger: Logger): ReadinessCheck {
  return createDatabaseReadiness(createPrismaDatabasePing(prisma), logger);
}
