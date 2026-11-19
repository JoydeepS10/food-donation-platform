import type { FieldError } from '../types/errors.ts';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: readonly FieldError[] | undefined;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: readonly FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
