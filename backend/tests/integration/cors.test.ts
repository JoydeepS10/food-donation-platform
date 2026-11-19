import test from 'node:test';
import assert from 'node:assert/strict';
import { isRecord } from '../helpers/json.ts';
import { testConfig } from '../helpers/test-config.ts';
import { startTestServer } from '../helpers/test-server.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCTION_FRONTEND = 'https://frontend.example.test';

interface ErrorBody {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
}

function readErrorBody(value: unknown): ErrorBody {
  assert.ok(isRecord(value));
  assert.ok(isRecord(value.error));

  const { code, message, requestId } = value.error;

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

function productionConfig() {
  return testConfig({
    NODE_ENV: 'production',
    FRONTEND_URL: PRODUCTION_FRONTEND,
    COOKIE_SECURE: true,
  });
}

test('CORS allows the configured frontend origin with credentials', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'GET',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.equal(response.headers.get('access-control-expose-headers'), 'X-Request-Id');
  assert.equal(response.headers.get('vary'), 'Origin');
});

test('CORS does not allow a different origin', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: 'OPTIONS',
    headers: {
      origin: 'http://evil.example.test',
      'access-control-request-method': 'GET',
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
});

test('CORS exposes X-Request-Id on an allowed cross-origin response', async (t) => {
  const server = await startTestServer(testConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    headers: {
      origin: 'http://localhost:5173',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('access-control-expose-headers'), 'X-Request-Id');
});

test('CORS never sends a null allow-origin', async (t) => {
  const server = await startTestServer(testConfig({ FRONTEND_URL: 'null' }));
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    headers: {
      origin: 'null',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('production rejects state-changing requests without an Origin', async (t) => {
  const server = await startTestServer(productionConfig());
  t.after(async () => {
    await server.close();
  });

  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const response = await fetch(`${server.baseUrl}/api/v1/health`, { method });
    assert.equal(response.status, 403, `Expected 403 for ${method}`);

    const body: unknown = await response.json();
    const error = readErrorBody(body);
    assert.equal(error.code, 'FORBIDDEN');
    assert.equal(response.headers.get('x-request-id'), error.requestId);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
});

test('production rejects state-changing requests from an unapproved origin', async (t) => {
  const server = await startTestServer(productionConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: 'POST',
    headers: {
      origin: 'https://evil.example.test',
    },
  });

  assert.equal(response.status, 403);

  const body: unknown = await response.json();
  const error = readErrorBody(body);
  assert.equal(error.code, 'FORBIDDEN');
  assert.equal(response.headers.get('x-request-id'), error.requestId);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('production lets an approved origin through to routing', async (t) => {
  const server = await startTestServer(productionConfig());
  t.after(async () => {
    await server.close();
  });

  const response = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: 'POST',
    headers: {
      origin: PRODUCTION_FRONTEND,
    },
  });

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('access-control-allow-origin'), PRODUCTION_FRONTEND);
});

test('production does not origin-reject GET, HEAD or OPTIONS', async (t) => {
  const server = await startTestServer(productionConfig());
  t.after(async () => {
    await server.close();
  });

  const expectedStatuses = new Map([
    ['GET', 200],
    ['HEAD', 200],
    ['OPTIONS', 204],
  ]);

  for (const [method, expectedStatus] of expectedStatuses) {
    for (const origin of [undefined, 'https://evil.example.test']) {
      const headers: Record<string, string> = {};
      if (origin !== undefined) {
        headers.origin = origin;
      }

      const response = await fetch(`${server.baseUrl}/api/v1/health`, { method, headers });
      assert.equal(response.status, expectedStatus, `Expected ${expectedStatus} for ${method}`);
    }
  }
});

test('development allows state-changing requests without an Origin but rejects a wrong Origin', async (t) => {
  const server = await startTestServer(testConfig({ NODE_ENV: 'development' }));
  t.after(async () => {
    await server.close();
  });

  const withoutOrigin = await fetch(`${server.baseUrl}/api/v1/health`, { method: 'POST' });
  assert.equal(withoutOrigin.status, 404);

  const wrongOrigin = await fetch(`${server.baseUrl}/api/v1/health`, {
    method: 'POST',
    headers: {
      origin: 'http://evil.example.test',
    },
  });
  assert.equal(wrongOrigin.status, 403);

  const body: unknown = await wrongOrigin.json();
  const error = readErrorBody(body);
  assert.equal(error.code, 'FORBIDDEN');
});
