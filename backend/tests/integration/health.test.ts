import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseReadiness } from '../../src/db/readiness.ts';
import { createLogger } from '../../src/utils/logger.ts';
import { isRecord } from '../helpers/json.ts';
import { testConfig } from '../helpers/test-config.ts';
import { startTestServer } from '../helpers/test-server.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('GET /api/v1/health returns the contract shape and security headers', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);

  const body: unknown = await response.json();
  assert.ok(isRecord(body));
  assert.equal(body.status, 'ok');
  assert.equal(body.version, '0.1.0');
  assert.equal(typeof body.timestamp, 'string');
  assert.ok(typeof body.timestamp === 'string' && !Number.isNaN(Date.parse(body.timestamp)));

  const requestId = response.headers.get('x-request-id');
  assert.ok(requestId);
  assert.match(requestId, UUID_PATTERN);

  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('GET /api/v1/health reports degraded when the readiness check fails', async (t) => {
  const server = await startTestServer(testConfig(), async () => false);
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);

  const body: unknown = await response.json();
  assert.ok(isRecord(body));
  assert.equal(body.status, 'degraded');
  assert.equal(body.version, '0.1.0');
  assert.equal(typeof body.timestamp, 'string');
});

test('an unreachable database reports degraded without leaking Prisma details', async (t) => {
  const logs: string[] = [];
  const logger = createLogger('warn', (line) => {
    logs.push(line);
  });
  const databaseError = new Error(
    'connect failed for donor.verified@food-demo.test with args SELECT * FROM users',
  );
  databaseError.name = 'PrismaClientInitializationError';

  const readiness = createDatabaseReadiness(async () => {
    throw databaseError;
  }, logger);
  const server = await startTestServer(testConfig(), readiness);
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`);
  assert.equal(response.status, 200);

  const body: unknown = await response.json();
  assert.ok(isRecord(body));
  assert.equal(body.status, 'degraded');
  assert.equal(logs.some((line) => line.includes('database.readiness_failed')), true);

  const serializedLogs = logs.join('\n');
  assert.doesNotMatch(serializedLogs, /donor\.verified@food-demo\.test/);
  assert.doesNotMatch(serializedLogs, /SELECT \* FROM users/);
  assert.doesNotMatch(serializedLogs, /connect failed/);
});
