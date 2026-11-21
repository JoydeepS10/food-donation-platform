/**
 * Guard for the destructive local database reset.
 *
 * `prisma migrate reset --force` drops every table, re-applies the migrations and runs the
 * seed. It must never run against production, and a developer must opt in explicitly in
 * `.env` so a mistyped command cannot wipe a local database by accident.
 */
export type ResetGuardDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly message: string };

export const ALLOW_DB_RESET_ENV = 'ALLOW_DB_RESET';

function isOptedIn(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

export function decideDatabaseReset(env: NodeJS.ProcessEnv): ResetGuardDecision {
  if (env.NODE_ENV === 'production') {
    return {
      allowed: false,
      message:
        'Refusing to reset the database: NODE_ENV=production. ' +
        '`prisma migrate reset --force` deletes every row and is never allowed against production.',
    };
  }

  if (!isOptedIn(env[ALLOW_DB_RESET_ENV])) {
    return {
      allowed: false,
      message: [
        'Refusing to reset the database.',
        '',
        '`npm run db:reset` deletes every row and re-applies all migrations.',
        'To allow it in local development, add this line to backend/.env:',
        '',
        `  ${ALLOW_DB_RESET_ENV}=true`,
        '',
        'Then run `npm run db:reset` again. The guard always refuses when NODE_ENV=production.',
      ].join('\n'),
    };
  }

  return { allowed: true };
}
