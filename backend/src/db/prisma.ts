import { PrismaClient } from '@prisma/client';

/**
 * The single Prisma client for this process.
 *
 * Logging is deliberately disabled on the client: Prisma's query/error logs can contain
 * query arguments, which must never reach application logs. Errors are classified by the
 * central error handler and the readiness check instead.
 */
export const prisma = new PrismaClient({ log: [] });
