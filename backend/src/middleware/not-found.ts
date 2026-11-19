import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.ts';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Route not found.'));
};
