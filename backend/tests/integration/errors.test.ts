import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createErrorHandler } from '../../src/middleware/error-handler.ts';
import { requestId } from '../../src/middleware/request-id.ts';
import { createLogger } from '../../src/utils/logger.ts';
import { isRecord } from '../helpers/json.ts';
import { testConfig } from '../helpers/test-config.ts';
import { startTestApp, startTestServer } from '../helpers/test-server.ts';

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

const FUTURE_OPERATIONS = [
  { method: 'POST', path: '/auth/register' },
  { method: 'POST', path: '/auth/login' },
  { method: 'POST', path: '/auth/logout' },
  { method: 'GET', path: '/auth/me' },
  { method: 'GET', path: '/donations' },
  { method: 'POST', path: '/donations' },
  { method: 'GET', path: '/donations/11111111-1111-4111-8111-111111111111' },
  { method: 'PATCH', path: '/donations/11111111-1111-4111-8111-111111111111' },
  { method: 'POST', path: '/donations/11111111-1111-4111-8111-111111111111/cancel' },
  { method: 'POST', path: '/donations/11111111-1111-4111-8111-111111111111/claims' },
  { method: 'PATCH', path: '/donations/11111111-1111-4111-8111-111111111111/status' },
  { method: 'GET', path: '/claims/me' },
  { method: 'GET', path: '/organisations/me' },
  { method: 'PATCH', path: '/organisations/me' },
  { method: 'POST', path: '/organisations/me/documents' },
  {
    method: 'GET',
    path: '/organisations/me/documents/11111111-1111-4111-8111-111111111111/download',
  },
  { method: 'POST', path: '/organisations/me/verification' },
  { method: 'GET', path: '/admin/organisations' },
  {
    method: 'GET',
    path: '/admin/organisations/11111111-1111-4111-8111-111111111111',
  },
  {
    method: 'GET',
    path: '/admin/organisations/11111111-1111-4111-8111-111111111111/documents/11111111-1111-4111-8111-111111111112/download',
  },
  {
    method: 'POST',
    path: '/admin/organisations/11111111-1111-4111-8111-111111111111/verification',
  },
  { method: 'GET', path: '/notifications' },
  { method: 'POST', path: '/notifications/11111111-1111-4111-8111-111111111111/read' },
  { method: 'POST', path: '/notifications/read-all' },
] as const;

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

test('an oversized JSON body returns FILE_TOO_LARGE', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ padding: 'x'.repeat(120 * 1024) }),
  });

  assert.equal(response.status, 413);

  const body: unknown = await response.json();
  const error = readErrorBody(body);
  assert.equal(error.code, 'FILE_TOO_LARGE');
  assert.equal(response.headers.get('x-request-id'), error.requestId);
});

test('no future-slice route is mounted', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  for (const operation of FUTURE_OPERATIONS) {
    const response = await fetch(`${server.baseUrl}/api/v1${operation.path}`, {
      method: operation.method,
    });

    assert.equal(
      response.status,
      404,
      `Expected 404 for ${operation.method} ${operation.path}`,
    );
  }
});

test('an unexpected error returns INTERNAL_ERROR without a stack trace', async (t) => {
  const logs: string[] = [];
  const logger = createLogger('error', (line) => {
    logs.push(line);
  });

  const app = express();
  app.use(requestId);
  app.get('/boom', () => {
    throw new Error('stack-secret-marker');
  });
  app.use(createErrorHandler(logger));

  const server = await startTestApp(app);
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/boom`);
  assert.equal(response.status, 500);

  const body: unknown = await response.json();
  const error = readErrorBody(body);
  assert.equal(error.code, 'INTERNAL_ERROR');
  assert.equal(error.message, 'An unexpected error occurred.');
  assert.equal(response.headers.get('x-request-id'), error.requestId);

  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /stack-secret-marker|Error:|at .*:\d+:\d+/);
  assert.equal(logs.some((line) => line.includes('request.unhandled_error')), true);
});
