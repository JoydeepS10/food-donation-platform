import test from 'node:test';
import assert from 'node:assert/strict';
import { EnvValidationError, loadEnv } from '../../src/config/env.ts';

const TEST_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/food_donation_test';

test('loadEnv applies defaults and normalises the frontend origin', () => {
  const config = loadEnv({
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:5173/',
    DATABASE_URL: TEST_DATABASE_URL,
  });

  assert.equal(config.NODE_ENV, 'test');
  assert.equal(config.PORT, 4000);
  assert.equal(config.FRONTEND_URL, 'http://localhost:5173');
  assert.equal(config.COOKIE_SECURE, false);
  assert.equal(config.JOBS_ENABLED, true);
  assert.equal(config.MAX_UPLOAD_BYTES, 10 * 1024 * 1024);
  assert.equal(config.DATABASE_URL, TEST_DATABASE_URL);
});

test('loadEnv rejects non-http frontend URL schemes', () => {
  const values = ['javascript:alert(1)', 'file:///tmp/x', 'ftp://example.test'];

  for (const value of values) {
    assert.throws(
      () => loadEnv({ NODE_ENV: 'test', FRONTEND_URL: value, DATABASE_URL: TEST_DATABASE_URL }),
      (error: unknown) => {
        assert.ok(error instanceof EnvValidationError);
        assert.match(error.message, /FRONTEND_URL/);
        assert.match(error.message, /http or https/);
        return true;
      },
      `Expected ${value} to be rejected.`,
    );
  }
});

test('loadEnv requires https for the frontend URL in production', () => {
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: 'production',
        FRONTEND_URL: 'http://example.test',
        DATABASE_URL: TEST_DATABASE_URL,
      }),
    (error: unknown) => {
      assert.ok(error instanceof EnvValidationError);
      assert.match(error.message, /FRONTEND_URL/);
      assert.match(error.message, /https/);
      return true;
    },
  );

  const config = loadEnv({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://example.test/',
    DATABASE_URL: TEST_DATABASE_URL,
  });
  assert.equal(config.FRONTEND_URL, 'https://example.test');
  assert.equal(config.COOKIE_SECURE, true);
});

test('loadEnv rejects a missing FRONTEND_URL without echoing values', () => {
  const secret = 'do-not-print-this-secret';

  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: 'test',
        DATABASE_URL: TEST_DATABASE_URL,
        S3_SECRET_ACCESS_KEY: secret,
      }),
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
        DATABASE_URL: TEST_DATABASE_URL,
        COOKIE_SECURE: 'false',
      }),
    /COOKIE_SECURE/,
  );
});

test('loadEnv requires a PostgreSQL DATABASE_URL without echoing it', () => {
  assert.throws(
    () => loadEnv({ NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173' }),
    (error: unknown) => {
      assert.ok(error instanceof EnvValidationError);
      assert.match(error.message, /DATABASE_URL/);
      return true;
    },
  );

  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:5173',
        DATABASE_URL: 'mysql://user:do-not-print-this-password@database.test:3306/app',
      }),
    (error: unknown) => {
      assert.ok(error instanceof EnvValidationError);
      assert.match(error.message, /DATABASE_URL/);
      assert.doesNotMatch(error.message, /do-not-print-this-password/);
      return true;
    },
  );
});
