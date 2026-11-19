import type { ErrorRequestHandler, Response } from 'express';
import type { ErrorEnvelope, FieldError } from '../types/errors.ts';
import { AppError } from '../utils/app-error.ts';
import type { Logger } from '../utils/logger.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBodyParserError(error: unknown): boolean {
  return isRecord(error) && typeof error.type === 'string' && error.type.startsWith('entity.');
}

function isOversizedBody(error: unknown): boolean {
  return isRecord(error) && error.type === 'entity.too.large';
}

function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  requestId: string,
  details?: readonly FieldError[],
): void {
  res.setHeader('X-Request-Id', requestId);

  const payload: ErrorEnvelope = {
    error: {
      code,
      message,
      requestId,
    },
  };

  if (details !== undefined && details.length > 0) {
    payload.error.details = details;
  }

  res.status(statusCode).json(payload);
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    if (res.headersSent) {
      _next(error);
      return;
    }

    const requestId = req.requestId;

    if (isOversizedBody(error)) {
      sendError(res, 413, 'FILE_TOO_LARGE', 'The request body is too large.', requestId);
      return;
    }

    if (isBodyParserError(error)) {
      sendError(res, 400, 'BAD_REQUEST', 'Malformed JSON request body.', requestId);
      return;
    }

    if (error instanceof AppError) {
      sendError(res, error.statusCode, error.code, error.message, requestId, error.details);
      return;
    }

    logger.error('request.unhandled_error', {
      requestId,
      method: req.method,
      path: req.path,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });

    sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.', requestId);
  };
}
