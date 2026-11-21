/**
 * Convert any thrown value into a log-safe description.
 *
 * Prisma errors are never logged with their message or stack: a Prisma validation error can
 * echo query arguments, and an initialisation error can echo connection details. Only the
 * Prisma error class name and, when present, its stable code are retained.
 *
 * Other errors keep their stack frames but lose the first stack line, which contains the
 * error message. Stack frames identify the failing call site without copying user-supplied
 * data such as emails, addresses or query arguments into the logs.
 */
export interface SafeErrorLog {
  readonly errorName: string;
  readonly errorCode: string | null;
  readonly stackFrames: string | null;
}

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
  if (error.stack === undefined) {
    return null;
  }

  // The first line is "<name>: <message>". Keep the call frames only.
  const frames = error.stack.split('\n').slice(1).join('\n').trim();
  return frames.length > 0 ? frames : null;
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
