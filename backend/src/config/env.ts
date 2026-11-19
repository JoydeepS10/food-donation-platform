import { z } from 'zod';

const booleanFromString = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return value;
}, z.boolean());

const frontendUrlSchema = z
  .string()
  .url('FRONTEND_URL must be an absolute URL.')
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  }, 'FRONTEND_URL must use http or https.')
  .transform((value) => new URL(value).origin);

const rawEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    FRONTEND_URL: frontendUrlSchema,
    APP_VERSION: z.string().min(1).default('0.1.0'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
    COOKIE_SECURE: booleanFromString.optional(),
    DATABASE_URL: z.string().min(1).optional(),
    JOBS_ENABLED: booleanFromString.default(true),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_UPLOAD_DIR: z.string().min(1).default('var/uploads'),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).optional(),
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && env.COOKIE_SECURE === false) {
      context.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production.',
      });
    }

    if (env.NODE_ENV === 'production' && new URL(env.FRONTEND_URL).protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['FRONTEND_URL'],
        message: 'FRONTEND_URL must use https in production.',
      });
    }
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  }));

export type AppConfig = z.infer<typeof rawEnvSchema>;

export class EnvValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = rawEnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    });
    throw new EnvValidationError(issues);
  }

  return result.data;
}
