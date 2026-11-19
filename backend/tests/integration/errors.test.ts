import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecord } from '../helpers/json.ts';
import { testConfig } from '../helpers/test-config.ts';
import { startTestServer } from '../helpers/test-server.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}

function readErrorBody(value: unknown): ErrorBody {
  assert.ok(isRecord(value));
  assert.ok(isRecord(value.error));

  const error = value.error;
  const { code, message, requestId } = error;

  if (typeof code !== 'string' || typeof message !== 'string' || typeof requestId !== 'string') {
    assert.fail('Expected the error envelope to contain string code, message and requestId.');
  }

  assert.match(requestId, UUID_PATTERN);

  return {
    code,
    message,
    requestId,
  };
}

test('an unknown route returns the shared error envelope', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/does-not-exist`);
  assert.equal(response.status, 404);

  const body: unknown = await response.json();
  const error = readErrorBody(body);
  assert.equal(error.code, 'NOT_FOUND');
  assert.equal(response.headers.get('x-request-id'), error.requestId);
  assert.equal('stack' in error, false);
});

test('malformed JSON returns BAD_REQUEST and keeps the request id', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: '{"broken":',
  });

  assert.equal(response.status, 400);

  const body: unknown = await response.json();
  const error = readErrorBody(body);
  assert.equal(error.code, 'BAD_REQUEST');
  assert.equal(response.headers.get('x-request-id'), error.requestId);
  assert.doesNotMatch(JSON.stringify(body), /SyntaxError|at .*:\\d+:\\d+/);
});

test('no future-slice route is mounted', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const paths = ['/api/v1/auth/me', '/api/v1/donations', '/api/v1/claims/me', '/api/v1/notifications'];

  for (const path of paths) {
    const response = await fetch(`${server.baseUrl}${path}`);
    assert.equal(response.status, 404, `Expected 404 for ${path}`);
  }
});
