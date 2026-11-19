import type { AppConfig } from '../../src/config/env.ts';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const base: AppConfig = {
    NODE_ENV: 'test',
    PORT: 0,
    FRONTEND_URL: 'http://localhost:5173',
    APP_VERSION: '0.1.0',
    LOG_LEVEL: 'error',
    SESSION_TTL_HOURS: 168,
    COOKIE_SECURE: false,
    JOBS_ENABLED: false,
    STORAGE_DRIVER: 'local',
    LOCAL_UPLOAD_DIR: 'var/uploads',
    MAX_UPLOAD_BYTES: 10 * 1024 * 1024,
  };

  return { ...base, ...overrides };
}
