/**
 * Convert any thrown value into a log-safe description.
 *
 * Prisma errors are never logged with their message or stack: a Prisma validation error can
 * echo query arguments, and an initialisation error can echo connection details. Only the
 * Prisma error class name and, when present, its stable code are retained.
 *
 * Other errors keep their stack frames only. The message is never kept: `Error.stack` starts
 * with `"<name>: <message>"`, and a multi-line message would otherwise smuggle every line
 * after the first into the log. Only lines that look like a V8 call frame (they end in
 * `:line:column`) are retained, so prose containing an email or address is dropped even when
 * it is crafted to look like a frame.
 */
export interface SafeErrorLog {
  readonly errorName: string;
  readonly errorCode: string | null;
  readonly stackFrames: string | null;
}

const MAX_STACK_FRAMES = 20;
const STACK_FRAME_PATTERN = /^\s+at\s+.*:\d+(?::\d+)?\)?$/;

function readStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = Reflect.get(value, key);
  return typeof candidate === 'string' ? candidate : null;
}

function isPrismaError(error: Error): boolean {
  return error.name.startsWith('PrismaClient');
}

function readStackFrames(error: Error): string | null {
  const stack = error.stack;

  if (typeof stack !== 'string') {
    return null;
  }

  const frames = stack
    .split(/\r?\n/)
    .filter((line) => STACK_FRAME_PATTERN.test(line))
    .slice(0, MAX_STACK_FRAMES);

  return frames.length > 0 ? frames.join('\n') : null;
}

export function describeErrorForLog(error: unknown): SafeErrorLog {
  if (error instanceof Error) {
    if (isPrismaError(error)) {
      return {
        errorName: error.name,
        errorCode: readStringProperty(error, 'code'),
        stackFrames: null,
      };
    }

    return {
      errorName: error.name,
      errorCode: null,
      stackFrames: readStackFrames(error),
    };
  }

  return {
    errorName: 'UnknownError',
    errorCode: null,
    stackFrames: null,
  };
}
