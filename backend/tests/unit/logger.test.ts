import test from 'node:test';
import assert from 'node:assert/strict';
import type { LogLevel } from '../../src/utils/logger.ts';
import { createLogger } from '../../src/utils/logger.ts';
import { isRecord } from '../helpers/json.ts';

test('logger writes structured JSON and respects the threshold', () => {
  const lines: Array<{ line: string; level: LogLevel }> = [];
  const logger = createLogger('warn', (line, level) => {
    lines.push({ line, level });
  });

  logger.info('ignored');
  logger.warn('kept', { requestId: 'abc' });

  assert.equal(lines.length, 1);

  const first = lines[0];
  assert.ok(first);
  assert.equal(first.level, 'warn');

  const parsed: unknown = JSON.parse(first.line);
  assert.ok(isRecord(parsed));
  assert.equal(parsed.message, 'kept');
  assert.equal(parsed.requestId, 'abc');
  assert.equal(typeof parsed.timestamp, 'string');
});
