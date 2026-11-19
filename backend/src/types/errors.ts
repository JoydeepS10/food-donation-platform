export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: readonly FieldError[];
  };
}
