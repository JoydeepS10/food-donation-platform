import { once } from 'node:events';
import type { Server } from 'node:http';
import { createApp } from '../../src/app.ts';
import type { AppConfig } from '../../src/config/env.ts';
import type { ReadinessCheck } from '../../src/controllers/health.controller.ts';

export interface TestServer {
  readonly baseUrl: string;
  close(): Promise<void>;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function startTestServer(
  config: AppConfig,
  readiness?: ReadinessCheck,
): Promise<TestServer> {
  const app = createApp(config, readiness);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();

  if (address === null || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Expected the test server to bind to a TCP port.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  };
}
