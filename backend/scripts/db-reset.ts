import { spawnSync } from 'node:child_process';
import { decideDatabaseReset } from './db-reset-guard.ts';

function main(): void {
  const decision = decideDatabaseReset(process.env);

  if (!decision.allowed) {
    console.error(decision.message);
    process.exitCode = 1;
    return;
  }

  // `shell: true` makes the same command work in Command Prompt, PowerShell and POSIX
  // shells. npm puts `node_modules/.bin` on PATH for scripts, so `prisma` resolves.
  const result = spawnSync('prisma migrate reset --force', {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.error !== undefined) {
    console.error(`Failed to start Prisma: ${result.error.message}`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = result.status ?? 1;
}

main();
