import test from 'node:test';
import assert from 'node:assert/strict';
import { EnvValidationError, loadEnv } from '../../src/config/env.ts';

test('loadEnv applies defaults and normalises the frontend origin', () => {
  const config = loadEnv({
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173/',
  });

  assert.equal(config.NODE_ENV, 'test');
  assert.equal(config.PORT, 4000);
  assert.equal(config.FRONTEND_URL, 'http://localhost:5173');
  assert.equal(config.COOKIE_SECURE, false);
  assert.equal(config.JOBS_ENABLED, true);
  assert.equal(config.MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
});

test('loadEnv rejects a missing FRONTEND_URL without echoing values', () => {
  const secret = 'do-not-print-this-secret';

  assert.throws(
    () => loadEnv({ NODE_ENV: 'test', S3_SECRET_ACCESS_KEY: secret }),
    (error: unknown) => {
      assert.ok(error instanceof EnvValidationError);
      assert.match(error.message, /FRONTEND_URL/);
      assert.doesNotMatch(error.message, /do-not-print-this-secret/);
      return true;
    },
  );
});

test('loadEnv requires secure cookies in production', () => {
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://example.test',
        COOKIE_SECURE: 'false',
      }),
    /COOKIE_SECURE/,
  );
});
