import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/utils/password.ts';

test('hashPassword produces the agreed scrypt format', async () => {
  const hash = await hashPassword('Demo1234!');
  const parts = hash.split('$');

  assert.equal(parts.length, 6);
  assert.equal(parts[0], 'scrypt');
  assert.equal(parts[1], '16384');
  assert.equal(parts[2], '8');
  assert.equal(parts[3], '1');
  assert.ok((parts[4] ?? '').length > 0);
  assert.ok((parts[5] ?? '').length > 0);
  assert.notEqual(hash, 'Demo1234!');
});

test('verifyPassword accepts the correct password and rejects a wrong one', async () => {
  const hash = await hashPassword('Demo1234!');

  assert.equal(await verifyPassword('Demo1234!', hash), true);
  assert.equal(await verifyPassword('Demo1234', hash), false);
  assert.equal(await verifyPassword('demo1234!', hash), false);
});

test('hashPassword uses a fresh salt per call', async () => {
  const first = await hashPassword('Demo1234!');
  const second = await hashPassword('Demo1234!');

  assert.notEqual(first, second);
  assert.equal(await verifyPassword('Demo1234!', first), true);
  assert.equal(await verifyPassword('Demo1234!', second), true);
});

test('verifyPassword rejects malformed and unsupported hashes', async () => {
  const malformed = [
    '',
    'plain-text',
    'scrypt$16384$8$1$only-five-parts',
    'scrypt$1$8$1$c2FsdA==$aGFzaA==',
    'scrypt$16384$8$1$not-base64$not-base64',
    'bcrypt$16384$8$1$c2FsdA==$aGFzaA==',
  ];

  for (const value of malformed) {
    assert.equal(await verifyPassword('Demo1234!', value), false, `Expected ${value} to be rejected.`);
  }
});
