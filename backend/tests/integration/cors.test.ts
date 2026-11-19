import test from 'node:test';
import assert from 'node:assert/strict';
import { testConfig } from '../helpers/test-config.ts';
import { startTestServer } from '../helpers/test-server.ts';

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
