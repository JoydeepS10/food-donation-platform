import test from 'node:test';
import assert from 'node:assert/strict';
import { decideDatabaseReset } from '../../scripts/db-reset-guard.ts';

test('the reset is refused unless ALLOW_DB_RESET is true', () => {
  const decision = decideDatabaseReset({ NODE_ENV: 'development' });

  assert.equal(decision.allowed, false);

  if (!decision.allowed) {
    assert.match(decision.message, /ALLOW_DB_RESET=true/);
    assert.match(decision.message, /backend\/\.env/);
  }
});

test('the reset is refused for values other than true', () => {
  for (const value of ['false', '1', 'yes', '']) {
    const decision = decideDatabaseReset({ NODE_ENV: 'development', ALLOW_DB_RESET: value });
    assert.equal(decision.allowed, false, `Expected "${value}" to be refused.`);
  }
});

test('the reset is allowed in development after an explicit opt-in', () => {
  for (const value of ['true', 'TRUE', ' true ']) {
    const decision = decideDatabaseReset({ NODE_ENV: 'development', ALLOW_DB_RESET: value });
    assert.deepEqual(decision, { allowed: true }, `Expected "${value}" to be allowed.`);
  }
});

test('the reset is always refused in production, even with the opt-in', () => {
  const decision = decideDatabaseReset({ NODE_ENV: 'production', ALLOW_DB_RESET: 'true' });

  assert.equal(decision.allowed, false);

  if (!decision.allowed) {
    assert.match(decision.message, /NODE_ENV=production/);
  }
});
